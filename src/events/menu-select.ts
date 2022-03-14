import { SelectMenuInteraction } from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnMenuSelect extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
        this.name = 'menuSelect';
    }

    public async callback(interaction: SelectMenuInteraction): Promise<void> {
        if (
            this.client.ready &&
            interaction.component !== undefined &&
            interaction.component.placeholder !== null &&
            interaction.component.placeholder !== undefined &&
            interaction.customId.includes('||')
        ) {
            this.eventQueue.addToQueue(interaction.message.id, () =>
                this.execute(interaction),
            );
        }
    }

    private async execute(interaction: SelectMenuInteraction): Promise<void> {
        if (!interaction.guildId || !this.client.user) return;
        await Queue.findOne({
            guildId: interaction.guildId,
            clientId: this.client.user.id,
        }).then((queue) => {
            if (!queue) return;
            this.client.emit('executeCommand', { interaction: interaction });
        });
    }
}
