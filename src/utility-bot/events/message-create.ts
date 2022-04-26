import { Message } from 'discord.js';
import { UtilityClient } from '../client';
import { RolesMessage } from '../entities';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnMessageCreate extends AbstractUtilityEvent {
    public constructor(client: UtilityClient) {
        super(client);
    }

    public async callback(message: Message): Promise<void> {
        if (message.channel.type === 'DM')
            return this.handlePrivateMessage(message);
        if (message.channel.type === 'GUILD_PUBLIC_THREAD')
            return this.handleThreadMessage(message);
        if (message.channel.type !== 'GUILD_TEXT') return;
        if (message.reference !== null) return this.handleReply(message);
    }

    private async handleThreadMessage(message: Message): Promise<void> {
        this.client.logger.debug(`Thread message ${message.id}`);
    }

    private async handleReply(message: Message): Promise<void> {
        if (!message.reference || !this.client.user) return;
        const referencedMsg: Message | undefined = await message
            .fetchReference()
            .catch((e) => {
                this.client.emitEvent('error', e);
                return undefined;
            });
        if (!referencedMsg || referencedMsg.author.id !== this.client.user.id)
            return;
        const rm: RolesMessage | undefined = await RolesMessage.findOne({
            messageId: referencedMsg.id,
        });
        if (rm)
            return this.client.emitEvent('handleRolesMessage', {
                type: 'reply',
                messageId: referencedMsg.id,
                repliedMessage: message,
            });
    }

    private async handlePrivateMessage(message: Message): Promise<void> {
        this.client.logger.debug(`Private message ${message.id}`);
    }
}

export namespace OnMessageCreate {
    export type Type = [
        'messageCreate',
        ...Parameters<OnMessageCreate['callback']>,
    ];
}
