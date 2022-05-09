import { Message, TextChannel, ThreadChannel } from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractMusicEvent } from '../utils/abstract-music-event';

export class OnThreadDelete extends AbstractMusicEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(thread: ThreadChannel): Promise<void> {
        if (thread.guildId && thread.ownerId === this.client.user?.id) {
            const gId: string = thread.guildId;
            this.client.logger.debug(
                `Thread '${thread.id}' deleted in guild '${gId}'`,
            );
            const queue: Queue | undefined = await Queue.findOne({
                clientId: this.client.user.id,
                guildId: gId,
                messageId: thread.id,
            }).catch((e) => {
                this.client.emitEvent('error', e);
                return undefined;
            });
            if (!queue) return;
            const channel: TextChannel | undefined = await this.client.channels
                .fetch(queue.channelId)
                .then((c) => {
                    if (!(c instanceof TextChannel)) return undefined;
                    return c;
                })
                .catch((e) => {
                    this.client.emitEvent('error', e);
                    return undefined;
                });
            if (!channel) {
                await queue.remove();
                return;
            }
            const message: Message | undefined = await channel.messages
                .fetch(queue.messageId)
                .catch((e) => {
                    this.client.emitEvent('error', e);
                    return undefined;
                });
            if (!message) {
                await queue.remove();
                return;
            }
            if (message.thread) return;
            this.client.emitEvent('queueMessageUpdate', {
                queue: queue,
                openThreadOnly: true,
                message: message,
            });
        }
    }
}

export namespace OnThreadDelete {
    export type Type = [
        'threadDelete',
        ...Parameters<OnThreadDelete['callback']>,
    ];
}
