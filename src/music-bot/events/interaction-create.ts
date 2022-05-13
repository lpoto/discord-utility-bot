import {
    CommandInteraction,
    GuildMember,
    Interaction,
    Message,
    MessageButton,
    MessageSelectMenu,
} from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractMusicEvent } from '../utils/abstract-music-event';

export class OnInteractionCreate extends AbstractMusicEvent {
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
            !interaction.channel ||
            interaction.replied ||
            !(interaction.member instanceof GuildMember) ||
            interaction.applicationId !== this.client.user?.id
        )
            return;
        if (!this.client.permsChecker.checkClientText(interaction.channel))
            return;

        if (interaction.isCommand())
            return this.client.emitEvent('slashCommand', interaction);

        Queue.findOne({
            guildId: interaction.guildId,
            clientId: this.client.user.id,
        }).then((queue) => {
            if (!queue) return;
            let name: string | undefined = undefined;
            if (interaction.isCommand()) name = 'COMMAND';
            else if (interaction.isButton()) name = 'BUTTON';
            else if (interaction.isSelectMenu()) name = 'SELECT';
            else return;
            this.client.logger.debug(
                `Interaction '${name}' one queue message`,
                `in guild '${interaction.guildId}'`,
            );
            if (
                !this.client.checkThreadAndMessage(queue) ||
                !interaction.member ||
                !(interaction.member instanceof GuildMember)
            )
                return;
            if (interaction instanceof CommandInteraction) return;
            if (
                interaction.message &&
                interaction.message.id !== queue.messageId
            ) {
                if (interaction.message instanceof Message)
                    interaction.message.delete().catch((e) => {
                        this.client.emitEvent('error', e);
                    });
                return;
            }

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
        });
    }
}

export namespace OnInteractionCreate {
    export type Type = [
        'interactionCreate',
        ...Parameters<OnInteractionCreate['callback']>,
    ];
}
