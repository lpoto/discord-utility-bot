import { SelectMenuInteraction } from 'discord.js';
import { UtilityClient } from '../client';
import { RolesMessage } from '../entities';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnMenuSelect extends AbstractUtilityEvent {
    public constructor(client: UtilityClient) {
        super(client);
    }

    public async callback(interaction: SelectMenuInteraction): Promise<void> {
        if (interaction.values.length > 0) {
            this.eventQueue.addToQueue(interaction.message.id, () =>
                this.execute(interaction),
            );
        }
    }

    private async execute(interaction: SelectMenuInteraction): Promise<void> {
        if (!interaction.guildId || !this.client.user) return;
        const rm: RolesMessage | undefined = await RolesMessage.findOne({
            messageId: interaction.message.id,
        }).catch((e) => {
            this.client.emitEvent('error', e);
            return undefined;
        });
        if (rm)
            return this.client.emitEvent('handleRolesMessage', {
                type: 'selectMenu',
                interaction: interaction,
                messageId: interaction.message.id,
            });
    }
}

export namespace OnMenuSelect {
    export type Type = ['menuSelect', ...Parameters<OnMenuSelect['callback']>];
}
