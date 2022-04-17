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
        this.client.activeCommandsOptions.clearOptions(options.guildId);
        const queue: Queue | undefined = await Queue.findOne({
            guildId: options.guildId,
            clientId: this.client.user.id,
        });
        if (!queue) return;
        if (options.threadId && queue.threadId !== options.threadId) return;
        this.client.channels
            .fetch(queue.channelId)
            .then((channel) => {
                if (!channel || !(channel instanceof TextChannel)) return;
                channel.threads
                    .fetch(queue.threadId)
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
                            .fetch(queue.messageId)
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
        Queue.remove(queue);
        this.client.destroyVoiceConnection(options.guildId);
    }
}

export namespace OnMusicDestroy {
    export type Type = [
        'musicDestroy',
        ...Parameters<OnMusicDestroy['callback']>
    ];
}
