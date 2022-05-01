import { randomUUID } from 'crypto';
import {
    Message,
    MessageActionRow,
    MessageButton,
    MessageEmbed,
    TextChannel,
} from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { UtilityClient } from '../client';
import { Poll } from '../entities/poll';
import { PollResponse } from '../entities/poll-response';
import { HandlePollMessageOptions } from '../utility-bot';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnHandlePollMessage extends AbstractUtilityEvent {
    private token = '⚫';

    public constructor(client: UtilityClient) {
        super(client);
    }

    public async callback(options: HandlePollMessageOptions): Promise<void> {
        switch (options.type) {
            case 'create':
                return this.createPoll(options);
            case 'buttonClick':
                return this.buttonClick(options);
            case 'threadMessage':
                return this.threadMessage(options);
            case 'reply':
                return this.reply(options);
        }
    }

    private async createPoll(
        options: HandlePollMessageOptions,
    ): Promise<void> {
        if (
            !options.interaction ||
            !options.interaction.isCommand() ||
            !(options.interaction.channel instanceof TextChannel) ||
            !(await this.client.rolesChecker.checkMemberRolesForCommand(
                options.interaction.member,
                'poll',
                options.interaction,
            ))
        )
            return;
        const channel: TextChannel = options.interaction.channel;
        const question: string | undefined = options.interaction.options
            .get('question')
            ?.value?.toString();
        const responses: PollResponse[] | undefined =
            options.interaction.options
                .get('responses')
                ?.value?.toString()
                .split(';')
                .map((r) => {
                    return PollResponse.create({
                        name: r.trim(),
                        users: [],
                    });
                });

        const poll: Poll = Poll.create({
            question: question ? question : 'The question?',
            guildId: channel.guildId,
            channelId: channel.id,
            commited: false,
            responses: responses ? responses : [],
        });
        await options.interaction
            .reply({
                fetchReply: true,
                embeds: [await this.pollMessageEmbed(poll)],
                components: this.getComponents(poll),
            })
            .then((m) => {
                if (!(m instanceof Message)) return;
                poll.messageId = m.id;
                poll.save();
                this.openThread(m);
            })
            .catch((e) => {
                this.client.emitEvent('error', e);
            });
    }

    private async updatePoll(
        options: HandlePollMessageOptions,
    ): Promise<void> {
        const poll: Poll | undefined = await Poll.findOne({
            messageId: options.messageId,
        }).catch((e) => {
            this.client.emitEvent('error', e);
            return undefined;
        });
        if (!poll) return;
        let pollMessage: Message | undefined = undefined;
        if (
            options.interaction &&
            options.interaction.isButton() &&
            options.interaction.message instanceof Message
        )
            pollMessage = options.interaction.message;
        if (
            !pollMessage &&
            options.threadMessage &&
            options.threadMessage.channel.isThread() &&
            options.threadMessage.channel.parent
        )
            pollMessage = await options.threadMessage.channel.parent.messages
                .fetch(options.messageId)
                .catch((e) => {
                    this.client.emitEvent('error', e);
                    return undefined;
                });
        if (
            !pollMessage &&
            options.repliedMessage &&
            options.repliedMessage.channel instanceof TextChannel
        )
            pollMessage = await options.repliedMessage.channel.messages
                .fetch(options.messageId)
                .catch((e) => {
                    this.client.emitEvent('error', e);
                    return undefined;
                });
        if (!pollMessage) return;
        if (options.interaction && !options.interaction.isCommand()) {
            options.interaction
                .update({
                    embeds: [await this.pollMessageEmbed(poll)],
                    components: this.getComponents(poll),
                })
                .catch((e) => {
                    this.client.emitEvent('error', e);
                });
        } else {
            pollMessage
                .edit({
                    embeds: [await this.pollMessageEmbed(poll)],
                    components: this.getComponents(poll),
                })
                .catch((e) => {
                    this.client.emitEvent('error', e);
                });
        }
    }

    private async buttonClick(
        options: HandlePollMessageOptions,
    ): Promise<void> {
        if (
            !options.interaction ||
            !options.interaction.isButton() ||
            !options.interaction.component
        )
            return;
        if (options.interaction.customId.includes('__'))
            return this.responseClick(options);
        if (
            !(await this.client.rolesChecker.checkMemberRolesForCommand(
                options.interaction.member,
                'poll',
                options.interaction,
            ))
        )
            return;
        if (options.interaction.component.label !== 'commit') return;
        return this.commit(options);
    }

    private async responseClick(
        options: HandlePollMessageOptions,
    ): Promise<void> {
        if (
            !options.interaction ||
            !options.interaction.isButton() ||
            !options.interaction.member ||
            !options.interaction.customId.includes('__')
        )
            return;
        const id: string = options.interaction.customId.split('__')[1];
        const poll: Poll | undefined = await Poll.findOne({
            messageId: options.messageId,
        }).catch((e) => {
            this.client.emitEvent('error', e);
            return undefined;
        });
        if (!poll) return;
        const r: PollResponse | undefined = poll.responses.find(
            (r2) => r2.id.toString() === id,
        );
        if (!r) return;
        if (r.users.includes(options.interaction.member.user.id)) {
            r.users = r.users.filter(
                (u) => u !== options.interaction?.member?.user.id,
            );
        } else {
            r.users.push(options.interaction.member.user.id);
        }
        await poll.save();
        this.updatePoll(options);
    }

    private async commit(options: HandlePollMessageOptions): Promise<void> {
        if (
            !options.interaction ||
            !options.interaction.isButton() ||
            !(options.interaction.message instanceof Message) ||
            options.interaction.component.label !== 'commit'
        )
            return;
        const poll: Poll | undefined = await Poll.findOne({
            messageId: options.messageId,
        }).catch((e) => {
            this.client.emitEvent('error', e);
            return undefined;
        });
        if (!poll) return;
        poll.commited = true;
        await poll.save();
        const msg: Message = options.interaction.message;
        if (msg.thread) {
            msg.thread.delete().catch((e) => {
                this.client.emitEvent('error', e);
            });
        }
        return this.updatePoll(options);
    }

    private async pollMessageEmbed(poll: Poll): Promise<MessageEmbed> {
        const embed: MessageEmbed = new MessageEmbed().setTitle(poll.question);
        if (!poll.commited) {
            if (poll.responses.length > 0)
                embed.setDescription(
                    'Responses: \n\n> ' +
                        poll.responses
                            .slice(0, 25)
                            .map((p) => p.name)
                            .join('\n> '),
                );
            else {
                embed.setDescription(
                    this.translate([
                        'utility',
                        'commands',
                        'poll',
                        'noResponses',
                    ]),
                );
            }
            embed.setFooter({
                text: this.translate([
                    'utility',
                    'commands',
                    'poll',
                    'replyToThread',
                ]),
            });
        } else {
            embed.setDescription('');
            embed.setFooter({ text: '' });
        }
        return embed;
    }

    private async reply(options: HandlePollMessageOptions): Promise<void> {
        if (
            !options.repliedMessage ||
            !(options.repliedMessage.channel instanceof TextChannel) ||
            !(await this.client.rolesChecker.checkMemberRolesForCommand(
                options.repliedMessage.member,
                'poll',
                undefined,
                options.repliedMessage.channelId,
            ))
        )
            return;
        if (
            ['edit', 'chane', 'open', 'reedit'].includes(
                options.repliedMessage.content.trim().toLowerCase(),
            )
        )
            return this.reedit(options);
        if (
            ['send', 'resend', 'renew', 'new'].includes(
                options.repliedMessage.content.trim().toLowerCase(),
            )
        )
            return this.resend(options);
    }

    private async threadMessage(
        options: HandlePollMessageOptions,
    ): Promise<void> {
        if (
            !this.client.user ||
            !options.threadMessage ||
            !options.threadMessage.channel.isThread() ||
            options.threadMessage.channel.ownerId !== this.client.user.id ||
            !(await this.client.rolesChecker.checkMemberRolesForCommand(
                options.threadMessage.member,
                'poll',
                undefined,
                options.threadMessage.channelId,
            ))
        )
            return;
        const content: string = options.threadMessage.content.trim();
        if (content.length > 75) return;
        if (content.toLowerCase().startsWith('question'))
            return await this.changeQuestion(options);
        if (
            ['remove', 'delete'].some((s) =>
                content.toLowerCase().startsWith(s),
            )
        )
            return this.removeResponse(options);
        return await this.addResponse(options);
    }

    private async changeQuestion(
        options: HandlePollMessageOptions,
    ): Promise<void> {
        if (!options.threadMessage) return;
        const poll: Poll | undefined = await Poll.findOne({
            messageId: options.messageId,
        });
        if (!poll) return;
        poll.question = options.threadMessage.content
            .replace(/question/i, '')
            .trim();
        if (poll.question.length < 1) return;
        await poll.save();
        await this.updatePoll(options);
    }

    private async addResponse(
        options: HandlePollMessageOptions,
    ): Promise<void> {
        if (!options.threadMessage) return;
        const poll: Poll | undefined = await Poll.findOne({
            messageId: options.messageId,
        });
        if (!poll) return;
        const response: string = options.threadMessage.content.trim();
        if (response.length < 1 || response.length > 75) return;
        if (poll.responses.find((r) => r.name === response)) return;
        const pollResponse: PollResponse = PollResponse.create({
            name: response,
            users: [],
        });
        poll.responses.push(pollResponse);
        await poll.save();
        await this.updatePoll(options);
    }

    private async removeResponse(
        options: HandlePollMessageOptions,
    ): Promise<void> {
        if (!options.threadMessage) return;
        const poll: Poll | undefined = await Poll.findOne({
            messageId: options.messageId,
        });
        if (!poll) return;
        try {
            const idx = Number(
                options.threadMessage.content
                    .replace(/(remove)|(delete)/i, '')
                    .trim(),
            );
            if (idx >= poll.responses.length) return;
            poll.responses = poll.responses.sort((a, b) => a.id - b.id);
            poll.responses.splice(idx, 1);
            await poll.save();
            await this.updatePoll(options);
        } catch (e) {
            return;
        }
    }

    private async reedit(options: HandlePollMessageOptions): Promise<void> {
        const poll: Poll | undefined = await Poll.findOne({
            messageId: options.messageId,
        });
        if (!poll) return;
        poll.commited = false;
        poll.created = new Date();
        await poll.save();
        const msg: Message | undefined =
            await options.repliedMessage?.fetchReference();
        if (msg) this.openThread(msg);
        await this.updatePoll(options);
    }

    private async resend(options: HandlePollMessageOptions): Promise<void> {
        if (
            !options.repliedMessage ||
            !(options.repliedMessage.channel instanceof TextChannel)
        )
            return;
        const poll: Poll | undefined = await Poll.findOne({
            messageId: options.messageId,
        });
        if (!poll) return;
        const channel: TextChannel = options.repliedMessage.channel;
        const oldMsg: Message | undefined = await channel.messages
            .fetch(options.messageId)
            .catch((e) => {
                this.client.emitEvent('error', e);
                return undefined;
            });
        if (!oldMsg) return;
        await channel
            .send({
                embeds: [await this.pollMessageEmbed(poll)],
                components: this.getComponents(poll),
            })
            .then(async (m) => {
                if (m) {
                    poll.messageId = m.id;
                    await poll.save();
                    if (!poll.commited) this.openThread(m);
                    oldMsg.delete().catch((e) => {
                        this.client.emitEvent('error', e);
                    });
                }
            })
            .catch((e) => {
                this.client.emitEvent('error', e);
            });
    }

    private openThread(pollMessage: Message): void {
        pollMessage
            .startThread({
                name: this.translate([
                    'utility',
                    'commands',
                    'poll',
                    'thread',
                    'name',
                ]),
                reason: this.translate([
                    'utility',
                    'commands',
                    'poll',
                    'thread',
                    'reason',
                ]),
            })
            .catch((e) => {
                this.client.emitEvent('error', e);
            });
    }

    private getComponents(poll: Poll): MessageActionRow[] {
        if (!poll.commited)
            return [
                new MessageActionRow().setComponents([
                    new MessageButton()
                        .setLabel('commit')
                        .setCustomId(randomUUID())
                        .setDisabled(poll.responses.length < 1)
                        .setStyle(MessageButtonStyles.SECONDARY),
                ]),
            ];
        if (poll.responses.length === 0) return [];
        const rows: MessageActionRow[] = [new MessageActionRow()];
        let idx = 0;
        const maxIdx: number = Math.ceil(poll.responses.length / 5);
        for (const r of poll.responses.sort((a, b) => a.id - b.id)) {
            if (rows[idx].components.length >= maxIdx) {
                if (idx >= 4) break;
                idx += 1;
                rows.push(new MessageActionRow());
            }
            rows[idx].addComponents([
                new MessageButton()
                    .setCustomId(randomUUID().toString() + '__' + r.id)
                    .setStyle(MessageButtonStyles.SECONDARY)
                    .setDisabled(false)
                    .setLabel(this.getLabel(r)),
            ]);
        }
        return rows;
    }

    private getLabel(response: PollResponse): string {
        let n: string = '\u3000' + response.name.trim();
        n += `\u2000(${response.users.length})\u3000`;
        const token: string = this.token;
        n += token.repeat(response.users.length);
        if (n.length > 80) n = n.substring(0, 77) + '...';
        else if (n.length + response.users.length < 40) {
            const x: number =
                n.length + response.users.length > 40
                    ? 0
                    : n.length + response.users.length;
            n += '\u2000'.repeat(40 - x);
        }
        return n;
    }
}

export namespace OnHandlePollMessage {
    export type Type = [
        'handlePollMessage',
        ...Parameters<OnHandlePollMessage['callback']>,
    ];
}
