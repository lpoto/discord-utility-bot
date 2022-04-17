import { Message, PartialMessage } from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnMessageDelete extends AbstractClientEvent {
    public constructor(client: MusicClient) {
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
            const queue: Queue | undefined = await Queue.findOne({
                guildId: message.guildId,
                clientId: this.client.user.id,
            });
            if (queue && queue.messageId === message.id)
                this.client.emitEvent('musicDestroy', {
                 guildId: message.guildId,
                });
        }
    }
}

export namespace OnMessageDelete {
    export type Type = [
        'messageDelete',
        ...Parameters<OnMessageDelete['callback']>
    ];
}
