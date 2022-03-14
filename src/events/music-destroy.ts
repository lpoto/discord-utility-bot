import { TextChannel } from 'discord.js';
import { DestroyMusicOptions } from '../../';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnMusicDestroy extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(options: DestroyMusicOptions): Promise<void> {
        if (!this.client.user) return;
        Queue.findOne({
            guildId: options.guildId,
            clientId: this.client.user.id,
        }).then((result) => {
            if (!result) return;
            if (options.threadId && result.threadId !== options.threadId)
                return;
            this.client.channels
                .fetch(result.channelId)
                .then((channel) => {
                    if (!channel || !(channel instanceof TextChannel)) return;
                    channel.threads
                        .fetch(result.threadId)
                        .then((thread) => {
                            if (thread)
                                this.client.emitEvent(
                                    'musicThreadArchive',
                                    thread,
                                );
                        })
                        .catch((e) => {
                            this.client.emitEvent('error', e);
                            channel.messages
                                .fetch(result.messageId)
                                .then((msg) => {
                                    if (!msg || !msg.deletable) return;
                                    msg.delete().catch((e2) => {
                                        this.client.emitEvent('error', e2);
                                    });
                                })
                                .catch((e2) => {
                                    this.client.emitEvent('error', e2);
                                });
                        });
                })
                .catch((error) => {
                    this.client.emitEvent('error', error);
                });
            Queue.remove(result);
            this.client.destroyVoiceConnection(options.guildId);
        });
    }
}

export namespace OnMusicDestroy {
    export type Type = [
        'musicDestroy',
        ...Parameters<OnMusicDestroy['callback']>
    ];
}