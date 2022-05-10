import { Message } from 'discord.js';
import { UtilityClient } from '../client';
import { RolesMessage } from '../entities';
import { Poll } from '../entities/poll';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnMessageCreate extends AbstractUtilityEvent {
    public constructor(client: UtilityClient) {
        super(client);
    }

    public async callback(message: Message): Promise<void> {
        if (!this.client.user || message.author.id === this.client.user.id)
            return;
        if (message.channel.isThread())
            return this.handleThreadMessage(message);
        if (message.channel.type !== 'GUILD_TEXT') return;
        if (message.reference !== null) return this.handleReply(message);
    }

    private async handleThreadMessage(message: Message): Promise<void> {
        if (
            !this.client.user ||
            !message.channel.isThread() ||
            !message.channel?.id ||
            message.channel.ownerId !== this.client.user.id
        )
            return;
        if (!this.client.permsChecker.checkClientText(message.channel)) return;
        this.client.logger.debug(
            `Thread message ${message.id} in guild ${message.guildId}`,
        );
        const poll: Poll | undefined = await Poll.findOne({
            messageId: message.channel.id,
        });
        if (poll)
            return this.client.emitEvent('handlePollMessage', {
                type: 'threadMessage',
                messageId: message.channel.id,
                threadMessage: message,
            });
    }

    private async handleReply(message: Message): Promise<void> {
        if (!message.reference || !this.client.user || !this.client.user)
            return;
        if (
            !this.client.user ||
            !message.channel.isThread() ||
            !message.channel?.id ||
            message.channel.ownerId !== this.client.user.id
        )
            return;
        const referencedMsg: Message | undefined = await message
            .fetchReference()
            .catch((e) => {
                this.client.emitEvent('error', e);
                return undefined;
            });
        if (!referencedMsg || referencedMsg.author.id !== this.client.user.id)
            return;
        if (!this.client.permsChecker.checkClientText(message.channel)) return;

        this.client.logger.debug(
            `Reply ${message.id} to message ${referencedMsg.id} in guild ${message.guildId}`,
        );

        const rm: RolesMessage | undefined = await RolesMessage.findOne({
            messageId: referencedMsg.id,
        });
        if (rm)
            return this.client.emitEvent('handleRolesMessage', {
                type: 'reply',
                messageId: referencedMsg.id,
                repliedMessage: message,
            });
        const poll: Poll | undefined = await Poll.findOne({
            messageId: referencedMsg.id,
        });
        if (poll)
            return this.client.emitEvent('handlePollMessage', {
                type: 'reply',
                messageId: referencedMsg.id,
                repliedMessage: message,
            });
    }
}

export namespace OnMessageCreate {
    export type Type = [
        'messageCreate',
        ...Parameters<OnMessageCreate['callback']>,
    ];
}
