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
    private toDefer: {
        [guildId: string]: (ButtonInteraction | SelectMenuInteraction)[];
    };
    private callbacks: {
        [guildId: string]: (() => Promise<void>)[];
    };
    private errorCallbacks: {
        [guildId: string]: (() => Promise<void>)[];
    };
    private updatingOptions: { [guildId: string]: UpdateQueueOptions };

    public constructor(client: MusicClient) {
        super(client);
        this.toDefer = {};
        this.updatingOptions = {};
        this.callbacks = {};
        this.errorCallbacks = {};
    }

    public async callback(options: UpdateQueueOptions): Promise<void> {
        if (
            options.interaction &&
            options.interaction instanceof CommandInteraction
        )
            return this.newQueueMessage(options);

        const guildId: string = options.queue.guildId;

        if (options.checkIfUpdated && this.client.alreadyUpdated(guildId)) {
            this.client.setAlreadyUpdated(guildId, false);
            if (options.onError) options.onError();
            return;
        }

        if (!options.checkIfUpdated && options.doNotSetUpdated) {
            this.client.setAlreadyUpdated(guildId, false);
        }

        if (options.onUpdate) {
            if (!(guildId in this.callbacks)) this.callbacks[guildId] = [];
            this.callbacks[guildId].push(options.onUpdate);
        }

        if (options.onError) {
            if (!(guildId in this.errorCallbacks))
                this.errorCallbacks[guildId] = [];
            this.errorCallbacks[guildId].push(options.onError);
        }

        if (guildId in this.updatingOptions) {
            if (options.message && !this.updatingOptions[guildId].message)
                this.updatingOptions[guildId].message = options.message;
            if (options.interaction)
                if (!this.updatingOptions[guildId].interaction) {
                    this.updatingOptions[guildId].interaction =
                        options.interaction;
                } else {
                    if (!(guildId in this.toDefer)) this.toDefer[guildId] = [];
                    this.toDefer[guildId].push(options.interaction);
                }
            return;
        }
        this.updatingOptions[guildId] = options;

        const timeout: NodeJS.Timeout = setTimeout(
            async () => {
                if (!this.updatingOptions[guildId]) return;
                await this.update(this.updatingOptions[guildId])
                    .then(() => {
                        if (!this.updatingOptions[guildId].doNotSetUpdated)
                            this.client.setAlreadyUpdated(guildId, true);

                        if (guildId in this.toDefer) {
                            for (const i of this.toDefer[guildId])
                                i.deferUpdate().catch((e) => {
                                    this.client.emit('error', e);
                                });
                            delete this.toDefer[guildId];
                        }
                        if (guildId in this.updatingOptions)
                            delete this.updatingOptions[guildId];
                    })
                    .catch((e) => {
                        this.handleErrorCallbacks(guildId);

                        if (guildId in this.updatingOptions)
                            delete this.updatingOptions[guildId];
                        if (guildId in this.callbacks) {
                            for (const c of this.callbacks[guildId])
                                c().catch((e2) => {
                                    this.client.emitEvent('error', e2);
                                });
                            delete this.callbacks[guildId];
                        }
                        this.client.emit('error', e);
                    });
            },
            options.timeout ? options.timeout : 150,
        );
        timeout.unref();
    }

    private async update(options: UpdateQueueOptions): Promise<void> {
        const queue: Queue = options.queue;
        await queue.reload();

        const updateOptions: InteractionReplyOptions =
            this.getQueueOptions(options);

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
            return interaction
                .update(updateOptions)
                .then(() => {
                    this.handleCallbacks(queue.guildId);
                })
                .catch((error) => {
                    this.handleErrorCallbacks(queue.guildId);
                    this.client.emit('error', error);
                });
        }
        if (options.message) {
            options.message
                .edit(updateOptions)
                .then(() => {
                    this.handleCallbacks(queue.guildId);
                })
                .catch((e) => {
                    this.client.emit('error', e);
                    this.handleErrorCallbacks(queue.guildId);
                });
            return;
        }

        const guild: Guild = await this.client.guilds.fetch(queue.guildId);
        if (!guild) return;
        const channel: NonThreadGuildBasedChannel | null =
            await guild.channels.fetch(queue.channelId);
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
                message
                    .edit(qOptions)
                    .then(() => {
                        this.handleCallbacks(queue.guildId);
                    })
                    .catch((e) => {
                        this.client.emit('error', e);
                        this.handleErrorCallbacks(queue.guildId);
                    });
            })
            .catch((error) => {
                this.client.emitEvent('error', error);
                this.handleCallbacks(queue.guildId);
            });
    }

    private getQueueOptions(
        options: UpdateQueueOptions,
    ): InteractionReplyOptions {
        const embedOptions: QueueEmbedOptions = options as QueueEmbedOptions;
        embedOptions.client = this.client;
        const components: MessageActionRow[] = [];
        let commandActionRow: MessageActionRow[] = [];
        commandActionRow = commandActionRow.concat(
            this.getCommandsActionRow(options.queue),
        );
        for (const row of commandActionRow) components.push(row);
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
                const button: MessageButton | null | undefined =
                    command?.button(queue);
                const dpdwn: MessageSelectMenu | null | undefined =
                    command?.selectMenu(queue);
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

    private async newQueueMessage(options: UpdateQueueOptions) {
        if (
            !options.interaction ||
            !(options.interaction instanceof CommandInteraction)
        )
            return;
        const interaction: CommandInteraction = options.interaction;
        const updateOptions: InteractionReplyOptions =
            this.getQueueOptions(options);
        return interaction
            .reply({
                fetchReply: true,
                embeds: updateOptions.embeds,
                components: updateOptions.components,
            })
            .then(async (message) => {
                if (!(message instanceof Message) || !message.guildId) return;

                const t: ThreadChannel = await message.startThread(
                    this.getThreadOptions(),
                );

                if (t && message.guildId && message.channelId) {
                    this.client.emitEvent('joinVoiceRequest', interaction);
                    options.queue.messageId = message.id;
                    options.queue.threadId = t.id;
                    options.queue.channelId = message.channelId;
                    options.queue.guildId = message.guildId;
                    options.queue.save();
                    return;
                }
                message.delete().catch((error) => {
                    this.client.emitEvent('error', error);
                });
            });
    }

    private handleCallbacks(guildId: string): void {
        if (guildId in this.callbacks)
            for (const c of this.callbacks[guildId]) {
                c().catch((e) => {
                    this.client.emitEvent('error', e);
                });
                delete this.callbacks[guildId];
            }
    }

    private handleErrorCallbacks(guildId: string): void {
        if (guildId in this.errorCallbacks)
            for (const c of this.errorCallbacks[guildId]) {
                c().catch((e) => {
                    this.client.emitEvent('error', e);
                });
                delete this.errorCallbacks[guildId];
            }
    }
}

export namespace OnQueueMessageUpdate {
    export type Type = [
        'queueMessageUpdate',
        ...Parameters<OnQueueMessageUpdate['callback']>
    ];
}
