import { CommandInteraction } from 'discord.js';
import { UtilityClient } from '../client';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnGamesSlashCommand extends AbstractUtilityEvent {
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

export namespace OnGamesSlashCommand {
    export type Type = [
        'gamesSlashCommand',
        ...Parameters<OnGamesSlashCommand['callback']>,
    ];
}