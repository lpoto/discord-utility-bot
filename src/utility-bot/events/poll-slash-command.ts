import { CommandInteraction } from 'discord.js';
import { UtilityClient } from '../client';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnPollSlashCommand extends AbstractUtilityEvent {
    public constructor(client: UtilityClient) {
        super(client);
    }

    public async callback(interaction: CommandInteraction): Promise<void> {
        this.eventQueue.addToQueue(interaction.id, () =>
            this.execute(interaction),
        );
    }

    private async execute(interaction: CommandInteraction): Promise<void> {
        interaction.reply({
            content: 'Sori ne dela zdle tole.',
            ephemeral: true,
        });
    }
}

export namespace OnPollSlashCommand {
    export type Type = [
        'pollSlashCommand',
        ...Parameters<OnPollSlashCommand['callback']>,
    ];
}
