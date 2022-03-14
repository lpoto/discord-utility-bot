import { ThreadChannel } from 'discord.js';
import { MusicClient } from '../client';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnThreadDelete extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
        this.name = 'threadDelete';
    }

    public async callback(thread: ThreadChannel): Promise<void> {
        if (thread.guildId && thread.ownerId === this.client.user?.id)
            this.client.emit('musicDestroy', {
                guildId: thread.guildId,
                threadId: thread.id,
            });
    }
}
