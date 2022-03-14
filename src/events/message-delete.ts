import { Message, PartialMessage } from 'discord.js';
import { MusicClient } from '../client';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnMessageDelete extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(
        message: Message<boolean> | PartialMessage,
    ): Promise<void> {
        if (message.guildId && message.author?.id === this.client.user?.id)
            this.client.emitEvent('musicDestroy', {
                guildId: message.guildId,
            });
    }
}

export namespace OnMessageDelete {
    export type Type = [
        'messageDelete',
        ...Parameters<OnMessageDelete['callback']>
    ];
}
