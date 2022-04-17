import { VoiceConnection } from '@discordjs/voice';
import {
    ButtonInteraction,
    GuildMember,
    Interaction,
    Message,
    MessageButton,
    MessageSelectMenu,
    SelectMenuInteraction,
} from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnInteractionCreate extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(interaction: Interaction): Promise<void> {
        if (
            !interaction.guildId ||
            (!interaction.isButton() &&
                !interaction.isCommand() &&
                !interaction.isSelectMenu()) ||
            interaction.deferred ||
            interaction.replied ||
            interaction.applicationId !== this.client.user?.id
        )
            return;
        Queue.findOne({
            guildId: interaction.guildId,
            clientId: this.client.user.id,
        }).then((queue) => {
            if (
                queue &&
                this.client.checkThreadAndMessage(queue) &&
                interaction.member &&
                interaction.member instanceof GuildMember
            ) {
                if (
                    (interaction instanceof ButtonInteraction ||
                        interaction instanceof SelectMenuInteraction) &&
                    interaction.message &&
                    interaction.message.id != queue.messageId
                ) {
                    if (interaction.message instanceof Message)
                        interaction.message.delete().catch((e) => {
                            this.client.emitEvent('error', e);
                        });
                    return;
                }
                if (
                    !this.client.permsChecker.checkMemberRoles(
                        interaction.member,
                    )
                ) {
                    interaction.reply({
                        content: this.client.translate(
                            interaction.guildId,
                            ['error', 'missingRole'],
                            [this.client.permsChecker.roles.join(', ')],
                        ),
                        ephemeral: true,
                    });
                    return;
                }

                if (
                    !interaction.guildId ||
                    !this.client.permsChecker.validateMemberVoice(interaction)
                )
                    return;

                const c: VoiceConnection | null =
                    this.client.getVoiceConnection(interaction.guildId);

                if (
                    !c ||
                    (interaction.guildId &&
                        !this.client.getVoiceConnection(
                            interaction.guildId,
                        )) ||
                    !interaction.guild?.me?.voice.channel
                )
                    this.client.emitEvent('joinVoiceRequest', interaction);

                if (
                    interaction.isButton() &&
                    interaction.component instanceof MessageButton
                ) {
                    this.client.emitEvent('buttonClick', interaction);
                    return;
                } else if (
                    interaction.isSelectMenu() &&
                    interaction.component instanceof MessageSelectMenu
                ) {
                    this.client.emitEvent('menuSelect', interaction);
                    return;
                }
            }

            if (!interaction.isCommand()) return;

            this.client.emitEvent('slashCommand', interaction);
        });
    }
}

export namespace OnInteractionCreate {
    export type Type = [
        'interactionCreate',
        ...Parameters<OnInteractionCreate['callback']>
    ];
}
