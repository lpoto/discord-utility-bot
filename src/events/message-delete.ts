import { Message, PartialMessage } from 'discord.js';
import { MusicClient } from '../client';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnMessageDelete extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
        this.name = 'messageDelete';
    }

    public async callback(
        message: Message<boolean> | PartialMessage,
    ): Promise<void> {
        if (message.guildId && message.author?.id === this.client.user?.id)
            this.client.musicActions.destroyMusic(message.guildId);
    }
}
