import { CommandInteraction, TextChannel } from 'discord.js';
import { UtilityClient } from '../client';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnPollSlashCommand extends AbstractUtilityEvent {
    public constructor(client: UtilityClient) {
        super(client);
    }

    public async callback(interaction: CommandInteraction): Promise<void> {
        if (
            interaction.guildId &&
            interaction.guild &&
            interaction.guild.me &&
            interaction.channel &&
            interaction.channel instanceof TextChannel &&
            interaction.member &&
            this.client.user
        ) {
            this.eventQueue.addToQueue(interaction.id, () =>
                this.execute(interaction),
            );
        }
    }

    private async execute(interaction: CommandInteraction): Promise<void> {
        if (
            !interaction.guild ||
            !interaction.channel ||
            !(interaction.channel instanceof TextChannel)
        )
            return;
        this.client.emitEvent('handlePollMessage', {
            type: 'create',
            messageId: '',
            interaction: interaction,
        });
    }
}

export namespace OnPollSlashCommand {
    export type Type = [
        'pollSlashCommand',
        ...Parameters<OnPollSlashCommand['callback']>,
    ];
}
