import { Message, PartialMessage } from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractMusicEvent } from '../utils/abstract-music-event';

export class OnMessageDelete extends AbstractMusicEvent {
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
            const gId: string = message.guildId;
            this.client.logger.debug(
                `Message '${message.id}' deleted in guild '${gId}'`,
            );
            const queue: Queue | undefined = await Queue.findOne({
                guildId: gId,
                clientId: this.client.user.id,
                messageId: message.id,
            }).catch((e) => {
                this.client.emitEvent('error', e);
                return undefined;
            });
            if (!queue) return;
            this.client.emitEvent('executeCommand', {
                name: 'Resend',
                message: message,
                doNotValidate: true,
            });
        }
    }
}

export namespace OnMessageDelete {
    export type Type = [
        'messageDelete',
        ...Parameters<OnMessageDelete['callback']>,
    ];
}
