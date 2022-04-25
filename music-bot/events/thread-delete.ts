import { ThreadChannel } from 'discord.js';
import { MusicClient } from '../client';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnThreadDelete extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(thread: ThreadChannel): Promise<void> {
        if (thread.guildId && thread.ownerId === this.client.user?.id)
            this.client.emitEvent('musicDestroy', {
                guildId: thread.guildId,
                threadId: thread.id,
            });
    }
}

export namespace OnThreadDelete {
    export type Type = [
        'threadDelete',
        ...Parameters<OnThreadDelete['callback']>
    ];
}
