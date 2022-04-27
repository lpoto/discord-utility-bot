import { Message, PartialMessage } from 'discord.js';
import { UtilityClient } from '../client';
import { RolesMessage } from '../entities';
import { Poll } from '../entities/poll';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnMessageDelete extends AbstractUtilityEvent {
    public constructor(client: UtilityClient) {
        super(client);
    }

    public async callback(
        message: Message<boolean> | PartialMessage,
    ): Promise<void> {
        if (
            message.guildId &&
            this.client.user &&
            message.author?.id === this.client.user?.id
        ) {
            if (message.hasThread) {
                message.thread?.delete().catch((e) => {
                    this.client.emitEvent('error', e);
                })
            }
            this.client.logger.debug('Deleting message ', message.id);
            RolesMessage.findOne({ messageId: message.id })
                .then((result) => {
                    result?.remove();
                })
                .catch((e) => this.client.emitEvent('error', e));
            Poll.findOne({ messageId: message.id })
                .then((result) => {
                    result?.remove();
                })
                .catch((e) => this.client.emitEvent('error', e));
        }
    }
}

export namespace OnMessageDelete {
    export type Type = [
        'messageDelete',
        ...Parameters<OnMessageDelete['callback']>,
    ];
}
