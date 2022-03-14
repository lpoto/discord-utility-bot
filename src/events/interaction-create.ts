import {
    GuildMember,
    Interaction,
    MessageButton,
    MessageSelectMenu,
} from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnInteractionCreate extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
        this.name = 'interactionCreate';
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
                    !this.client.permsChecker.checkMemberRoles(
                        interaction.member,
                    )
                ) {
                    interaction.reply({
                        content:
                            this.client.translate(interaction.guildId, [
                                'error',
                                'missingRole',
                            ]) +
                            `\`${this.client.permsChecker.roles.join(', ')}\``,
                        ephemeral: true,
                    });
                    return;
                }

                if (!this.client.permsChecker.validateMemberVoice(interaction))
                    return;

                if (
                    (interaction.guildId &&
                        !this.client.getVoiceConnection(
                            interaction.guildId,
                        )) ||
                    !interaction.guild?.me?.voice.channel
                )
                    this.client.emit('joinVoiceRequest', interaction);
                if (
                    interaction.isButton() &&
                    interaction.component instanceof MessageButton
                ) {
                    this.client.emit('buttonClick', interaction);
                    return;
                } else if (
                    interaction.isSelectMenu() &&
                    interaction.component instanceof MessageSelectMenu
                ) {
                    this.client.emit('menuSelect', interaction);
                    return;
                }
            }
            if (!interaction.isCommand()) return;

            this.client.emit('slashCommand', interaction);
        });
    }
}
