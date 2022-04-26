import { ButtonInteraction } from 'discord.js';
import { UtilityClient } from '../client';
import { RolesMessage } from '../entities';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnButtonClick extends AbstractUtilityEvent {
    public constructor(client: UtilityClient) {
        super(client);
    }

    public async callback(interaction: ButtonInteraction): Promise<void> {
        if (
            interaction.component !== undefined &&
            interaction.component.label !== null &&
            interaction.component.label !== undefined
        ) {
            this.eventQueue.addToQueue(interaction.message.id, () =>
                this.execute(interaction),
            );
        }
    }

    private async execute(interaction: ButtonInteraction): Promise<void> {
        if (!interaction.guildId || !this.client.user) return;
        const rm: RolesMessage | undefined = await RolesMessage.findOne({
            messageId: interaction.message.id,
        }).catch((e) => {
            this.client.emitEvent('error', e);
            return undefined;
        });
        if (rm)
            return this.client.emitEvent('handleRolesMessage', {
                type: 'buttonClick',
                interaction: interaction,
                messageId: interaction.message.id,
            });
    }
}

export namespace OnButtonClick {
    export type Type = [
        'buttonClick',
        ...Parameters<OnButtonClick['callback']>,
    ];
}
