import {
    ButtonInteraction,
    CommandInteraction,
    Guild,
    InteractionReplyOptions,
    Message,
    MessageActionRow,
    MessageButton,
    MessageSelectMenu,
    NonThreadGuildBasedChannel,
    SelectMenuInteraction,
    StartThreadOptions,
    ThreadChannel,
} from 'discord.js';
import { Command, QueueEmbedOptions, UpdateQueueOptions } from '../../';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { QueueEmbed } from '../utils';
import { AbstractClientEvent } from '../utils/abstract-client-event';
import * as Commands from '../commands';

export class OnQueueMessageUpdate extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(options: UpdateQueueOptions): Promise<void> {
        await this.update(options)
            .then(() => {
                if (
                    options.interaction &&
                    (options.interaction instanceof ButtonInteraction ||
                        options.interaction instanceof SelectMenuInteraction)
                )
                    options.interaction.deferUpdate();
            })
            .catch((e) => {
                this.client.emit('error', e);
            });
    }

    private async update(options: UpdateQueueOptions): Promise<void> {
        const queue: Queue = options.queue;
        if (options.reload) await queue.reload();
        const updateOptions: InteractionReplyOptions = this.getQueueOptions(
            options,
        );

        const interaction:
            | ButtonInteraction
            | CommandInteraction
            | SelectMenuInteraction
            | undefined = options.interaction;

        if (
            interaction &&
            (interaction instanceof ButtonInteraction ||
                interaction instanceof SelectMenuInteraction) &&
            !interaction.deferred &&
            !interaction.replied
        ) {
            return interaction.update(updateOptions).catch((error) => {
                this.client.emit('error', error);
            });
        }

        if (interaction && interaction instanceof CommandInteraction) {
            return interaction
                .reply({
                    fetchReply: true,
                    embeds: updateOptions.embeds,
                    components: updateOptions.components,
                })
                .then((message) => {
                    if (!(message instanceof Message)) return;
                    message
                        .startThread(this.getThreadOptions())
                        .then(async (t) => {
                            if (t && message.guildId && message.channelId) {
                                this.client.emitEvent(
                                    'joinVoiceRequest',
                                    interaction,
                                );
                                queue.messageId = message.id;
                                queue.threadId = t.id;
                                queue.channelId = message.channelId;
                                queue.guildId = message.guildId;
                                queue.save();
                                return;
                            }
                            message.delete().catch((error) => {
                                this.client.emitEvent('error', error);
                            });
                        });
                });
        }
        const guild: Guild = await this.client.guilds.fetch(queue.guildId);
        if (!guild) return;
        const channel: NonThreadGuildBasedChannel | null = await guild.channels.fetch(
            queue.channelId,
        );
        if (!channel || !channel.isText()) return;
        const thread: ThreadChannel | null = await channel.threads.fetch(
            queue.threadId,
        );
        if (!thread) return;
        return await thread
            .fetchStarterMessage()
            .then(async (message) => {
                if (!message) return;
                await options.queue.reload();
                const qOptions = this.getQueueOptions(options);
                message.edit(qOptions);
            })
            .catch((error) => {
                this.client.emitEvent('error', error);
            });
    }

    private getQueueOptions(
        options: UpdateQueueOptions,
    ): InteractionReplyOptions {
        const embedOptions: QueueEmbedOptions = options as QueueEmbedOptions;
        embedOptions.client = this.client;
        if (options.embedOnly) {
            return {
                embeds: [new QueueEmbed(embedOptions)],
            };
        }
        const components: MessageActionRow[] = [];
        let commandActionRow: MessageActionRow[] = [];
        commandActionRow = commandActionRow.concat(
            this.getCommandsActionRow(options.queue),
        );
        for (const row of commandActionRow) components.push(row);
        if (options.componentsOnly) {
            return {
                components: components,
            };
        }
        return {
            embeds: [new QueueEmbed(embedOptions)],
            components: components,
        };
    }

    private getCommandsActionRow(queue: Queue): MessageActionRow[] {
        const buttons: MessageButton[] = [];
        let dropdown: MessageSelectMenu | null = null;
        for (const val in Commands) {
            try {
                const command: Command | null = this.getCommand(
                    val,
                    queue.guildId,
                );
                const button:
                    | MessageButton
                    | null
                    | undefined = command?.button(queue);
                const dpdwn:
                    | MessageSelectMenu
                    | null
                    | undefined = command?.selectMenu(queue);
                if (dpdwn) dropdown = dpdwn;
                if (!command || !button) continue;
                buttons.push(button);
            } catch (e) {
                console.error(e);
            }
        }
        const rows: MessageActionRow[] = [];
        rows.push(new MessageActionRow());
        let lenIdx = 0;
        let idx = 0;
        for (let i = 0; i < buttons.length; i++) {
            if (rows.length > 5) break;
            const len: number = idx % 2 === 0 ? 4 : 5;
            if (buttons.length > len && i === lenIdx + len) {
                lenIdx += len;
                rows.push(new MessageActionRow());
                idx += 1;
            }
            rows[idx].addComponents(buttons[i]);
        }
        if (dropdown && rows.length < 5) {
            rows.push(new MessageActionRow().addComponents(dropdown));
        }
        if (rows[0].components.length === 0) return [];
        return rows;
    }

    private getCommand(val: string, guildId: string): Command | null {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new (<any>Commands)[val](this.client, guildId);
    }

    private getThreadOptions(): StartThreadOptions {
        return {
            name: this.client.translate(null, ['music', 'thread', 'name']),
            reason: this.client.translate(null, ['music', 'thread', 'reason']),
        };
    }
}

export namespace OnQueueMessageUpdate {
    export type Type = [
        'queueMessageUpdate',
        ...Parameters<OnQueueMessageUpdate['callback']>
    ];
}
