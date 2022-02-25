import {
    ButtonInteraction,
    CommandInteraction,
    DiscordAPIError,
    GuildMember,
    Interaction,
    Message,
    MessageButton,
    TextChannel,
    ThreadChannel,
    VoiceState,
} from 'discord.js';
import moment from 'moment';
import { Queue } from '../entities';
import { Notification } from '../entities/notification';
import { LanguageKeyPath } from '../translation';
import { MusicClient } from './client';

export class ClientEventHandler {
    private client: MusicClient;
    private slashCommandQueue: CommandInteraction[];
    private buttonClickQueue: { [messageId: string]: ButtonInteraction[] };

    constructor(client: MusicClient) {
        this.client = client;
        this.slashCommandQueue = [];
        this.buttonClickQueue = {};
    }

    get permissionChecker() {
        return this.client.permsChecker;
    }

    get actions() {
        return this.client.musicActions;
    }

    private translate(guildId: string | null, keys: LanguageKeyPath) {
        return this.client.translate(guildId, keys);
    }

    public async subscribe(token: string): Promise<void> {
        this.client.on('ready', () => {
            Queue.find().then((queues) => {
                for (const queue of queues)
                    this.checkThreadAndMessage(queue, true).catch((e) => {
                        this.client.handleError(e);
                    });
            });
            this.client.setup(token);
        });

        this.client.on(
            'voiceStateUpdate',
            (voiceStatePrev, voiceStateAfter) => {
                this.handleVoiceStateUpdate(voiceStatePrev, voiceStateAfter);
            },
        );

        this.client.on('error', (error: Error) => {
            this.handleError(error);
        });

        this.client.on('interactionCreate', (interaction) => {
            this.handleInteraction(interaction);
        });

        this.client.on('messageCreate', (message) => {
            if (message.channel instanceof ThreadChannel) {
                this.handleThreadMessage(message);
            }
        });

        this.client.on('messageDelete', (message) => {
            if (message.guildId && message.author?.id === this.client.user?.id)
                this.destroyMusic(message.guildId);
        });

        this.client.on('threadDelete', (thread) => {
            if (thread.guildId && thread.ownerId === this.client.user?.id)
                this.destroyMusic(thread.guildId, thread.id);
        });

        this.client.on('guildCreate', (guild) => {
            this.client.registerSlashCommand(guild.id, token);
        });
    }

    public handleError(error: Error, location?: string): void {
        try {
            /* if discordApiError, do not log errors when fetching already
             * deleted messages or missing permissions to delete threads...*/
            const discordError: DiscordAPIError = error as DiscordAPIError;
            if (
                [
                    '10008',
                    '50013',
                    '10003',
                    '10062',
                    '50001',
                    '40060',
                    '50083',
                ].includes(discordError.code.toString())
            )
                return;
        } catch (e) {
            console.error(location ? `Error (${location}): ` : 'Error: ', e);
            return;
        }
        console.error(location ? `Error (${location}): ` : 'Error: ', error);
    }

    private handleVoiceStateUpdate(
        voiceStatePrev: VoiceState,
        voiceStateAfter: VoiceState,
    ): void {
        if (voiceStatePrev.member?.id !== this.client.user?.id) return;
        if (voiceStatePrev.channel?.id === voiceStateAfter.channel?.id) return;
        const guildId: string = voiceStateAfter.guild.id;
        if (
            (voiceStateAfter.channel?.id === undefined ||
                voiceStatePrev.channel?.id === undefined) &&
            this.client.user
        ) {
            if (voiceStateAfter.channel?.id === undefined)
                this.client.destroyVoiceConnection(guildId);
            Queue.findOne({
                guildId: guildId,
                clientId: this.client.user.id,
            }).then((queue) => {
                if (queue) this.actions.updateQueueMessage(queue);
            });
        }
        const prevId: string | undefined = voiceStatePrev.channel?.id;
        const afterId: string | undefined = voiceStateAfter.channel?.id;
        console.log(`Voice channel update: ${prevId} -> ${afterId}`);
    }

    private handleThreadMessage(message: Message): void {
        if (
            message.guildId &&
            message.member instanceof GuildMember &&
            message.channel instanceof ThreadChannel &&
            message.channel.name ===
                this.translate(message.guildId, ['music', 'thread', 'name']) &&
            message.content &&
            message.channel.ownerId === this.client.user?.id &&
            this.permissionChecker.checkMemberRoles(message.member) &&
            this.permissionChecker.validateMemberVoiceFromThread(message)
        ) {
            Queue.findOne({
                guildId: message.guildId,
                clientId: this.client.user.id,
            }).then((queue) => {
                if (!queue) return;

                if (
                    (message.guildId &&
                        !this.client.getVoiceConnection(message.guildId)) ||
                    !message.guild?.me?.voice.channel
                )
                    this.actions.joinVoice(null, message);

                const songs: string[] = message.content
                    .split('\n')
                    .map((s) => {
                        let n: string = s.trim();
                        if (n[0] === '{' && n.includes('url:')) {
                            n = s.substring(1, n.length - 1);
                            n = n.split('url:')[1].split(',')[0].trim();
                        }
                        if (
                            (n[0] === '"' && n[n.length - 1] === '"') ||
                            // eslint-disable-next-line
                            (n[0] === "'" && n[n.length - 1] === "'") ||
                            (n[0] === '`' && n[n.length - 1] === '`')
                        )
                            n = n.substring(1, n.length - 1);
                        return n;
                    });

                this.actions.songsToQueue(queue, songs).then((exit) => {
                    if (exit === 100 && this.client.user && message.guildId) {
                        const notification: Notification = Notification.create(
                            {
                                userId: message.author.id,
                                clientId: this.client.user.id,
                                guildId: message.guildId,
                                expires: moment(moment.now())
                                    .add(24, 'h')
                                    .toDate(),
                                name: 'maxSongs',
                            },
                        );
                        Notification.findOne({
                            userId: notification.userId,
                            clientId: notification.clientId,
                            guildId: notification.guildId,
                            name: notification.name,
                        }).then((n) => {
                            if (n) return;
                            notification.save().then(() => {
                                message
                                    .reply({
                                        content: this.translate(
                                            message.guildId,
                                            [
                                                'music',
                                                'commands',
                                                'play',
                                                'maxSongs',
                                            ],
                                        ),
                                    })
                                    .catch((e) => {
                                        this.client.handleError(e);
                                    });
                            });
                        });
                        notification;
                    }
                });
            });
        }
    }

    private handleInteraction(interaction: Interaction): void {
        if (
            !interaction.guildId ||
            (!interaction.isButton() && !interaction.isCommand()) ||
            interaction.deferred ||
            interaction.replied ||
            interaction.applicationId !== this.client.user?.id
        )
            return;
        Queue.findOne({
            guildId: interaction.guildId,
            clientId: this.client.user.id,
        }).then((queue) => {
            if (
                queue &&
                this.checkThreadAndMessage(queue) &&
                interaction.member &&
                interaction.member instanceof GuildMember
            ) {
                if (
                    !this.permissionChecker.checkMemberRoles(
                        interaction.member,
                    )
                ) {
                    interaction.reply({
                        content:
                            this.client.translate(interaction.guildId, [
                                'error',
                                'missingRole',
                            ]) +
                            `\`${this.permissionChecker.roles.join(', ')}\``,
                        ephemeral: true,
                    });
                    return;
                }

                if (!this.permissionChecker.validateMemberVoice(interaction))
                    return;

                if (
                    (interaction.guildId &&
                        !this.client.getVoiceConnection(
                            interaction.guildId,
                        )) ||
                    !interaction.guild?.me?.voice.channel
                )
                    this.actions.joinVoice(interaction);

                if (
                    interaction.isButton() &&
                    interaction.component instanceof MessageButton
                ) {
                    if (!(interaction.message.id in this.buttonClickQueue))
                        this.buttonClickQueue[interaction.message.id] = [];
                    this.buttonClickQueue[interaction.message.id].push(
                        interaction,
                    );
                    if (
                        this.buttonClickQueue[interaction.message.id]
                            .length === 1
                    )
                        this.handleButtonClick(interaction);
                    return;
                }
            }
            if (
                !interaction.isCommand() ||
                interaction.commandName !==
                    this.translate(interaction.guildId, [
                        'slashCommand',
                        'name',
                    ])
            )
                return;

            this.slashCommandQueue.push(interaction);
            if (this.slashCommandQueue.length === 1)
                this.handleSlashCommand(interaction);
        });
    }

    private handleButtonClick(interaction: ButtonInteraction): void {
        if (
            interaction.guildId !== undefined &&
            this.client.user &&
            interaction.guildId !== null &&
            interaction.component.label !== null &&
            interaction.component.label !== undefined
        ) {
            Queue.findOne({
                guildId: interaction.guildId,
                clientId: this.client.user.id,
            }).then((queue) => {
                if (!queue) return;
                this.actions.executeFromInteraction(interaction);
            });
        }
        this.buttonClickQueue[interaction.message.id].shift();
        if (this.buttonClickQueue[interaction.message.id].length === 0)
            delete this.buttonClickQueue[interaction.message.id];
        else
            this.handleButtonClick(
                this.buttonClickQueue[interaction.message.id][0],
            );
    }

    private async checkThreadAndMessage(
        queue: Queue,
        update?: boolean,
    ): Promise<Message | null> {
        return this.client.channels
            .fetch(queue.channelId)
            .then((channel) => {
                if (!channel || !(channel instanceof TextChannel)) return null;
                return channel.threads
                    .fetch(queue.threadId)
                    .then((thread) => {
                        return channel.messages
                            .fetch(queue.messageId)
                            .then((message) => {
                                if (!message && thread) {
                                    this.archiveMusicThread(thread);
                                    return null;
                                }
                                if (!thread && message) {
                                    message
                                        .delete()
                                        .catch((error) =>
                                            this.handleError(error),
                                        );
                                    return null;
                                }
                                if (update)
                                    this.actions.updateQueueMessage(queue);
                                return message;
                            })
                            .catch((e) => {
                                this.client.handleError(e);
                                this.archiveMusicThread(thread);
                                return null;
                            });
                    })
                    .catch((error) => {
                        this.client.handleError(error);
                        return null;
                    });
            })
            .catch((e) => {
                this.client.handleError(e);
                return null;
            });
    }

    private async handleSlashCommand(
        interaction: CommandInteraction,
    ): Promise<void> {
        if (
            interaction.guildId &&
            interaction.guild &&
            interaction.guild.me &&
            interaction.channel &&
            interaction.channel instanceof TextChannel &&
            interaction.member &&
            this.client.user &&
            interaction.member instanceof GuildMember &&
            this.permissionChecker.checkClientText(interaction.channel)
        ) {
            console.log('Handle slash command:', interaction.id);

            const queue = await Queue.findOne({
                guildId: interaction.guildId,
                clientId: this.client.user.id,
            });
            let message: Message | null = null;
            if (queue) message = await this.checkThreadAndMessage(queue);

            if (queue && message) {
                interaction.reply({
                    content:
                        this.translate(interaction.guildId, [
                            'error',
                            'activeThread',
                        ]) +
                        '\n' +
                        message.url,
                    ephemeral: true,
                    fetchReply: true,
                });
            } else if (
                this.client.user &&
                this.permissionChecker.validateMemberVoice(interaction)
            ) {
                console.log(
                    `Initializing queue message in guild ${interaction.guildId}`,
                );

                const q: Queue = Queue.create({
                    clientId: this.client.user.id,
                    offset: 0,
                    songs: [],
                    options: [],
                    color: Math.floor(Math.random() * 16777215),
                });

                this.actions.replyWithQueue(q, interaction).then((result) => {
                    if (
                        result &&
                        q.messageId &&
                        q.threadId &&
                        q.channelId &&
                        q.guildId
                    )
                        Queue.save(q);
                });
            }
        }
        this.slashCommandQueue.shift();
        if (this.slashCommandQueue.length > 0)
            this.handleSlashCommand(this.slashCommandQueue[0]);
    }

    public destroyMusic(guildId: string, threadId?: string): void {
        if (!this.client.user) return;
        Queue.findOne({
            guildId: guildId,
            clientId: this.client.user.id,
        }).then((result) => {
            if (!result) return;
            if (threadId && result.threadId !== threadId) return;
            this.client.channels
                .fetch(result.channelId)
                .then((channel) => {
                    if (!channel || !(channel instanceof TextChannel)) return;
                    channel.threads
                        .fetch(result.threadId)
                        .then((thread) => {
                            if (thread) this.archiveMusicThread(thread);
                        })
                        .catch((e) => {
                            this.client.handleError(e);
                            channel.messages
                                .fetch(result.messageId)
                                .then((msg) => {
                                    if (!msg || !msg.deletable) return;
                                    msg.delete().catch((e2) => {
                                        this.client.handleError(e2);
                                    });
                                })
                                .catch((e2) => {
                                    this.client.handleError(e2);
                                });
                        });
                })
                .catch((error) => {
                    this.client.handleError(error);
                });
            Queue.remove(result);
            this.client.destroyVoiceConnection(guildId);
        });
    }

    /** Archive a music thread, delete it if possible and delete
     * the queue message */
    private async archiveMusicThread(
        thread: ThreadChannel | null,
    ): Promise<void> {
        if (
            !thread ||
            !thread.guild ||
            !thread.guildId ||
            !thread.parentId ||
            thread.ownerId !== this.client.user?.id
        )
            return;
        thread
            .setName(
                this.translate(thread.guildId, [
                    'music',
                    'thread',
                    'archivedName',
                ]),
            )
            .then(() => {
                thread
                    .setArchived()
                    .then(() => {
                        console.log(`Archived thread: ${thread.id}`);
                        thread
                            .fetchStarterMessage()
                            .then((message) => {
                                message.delete().catch((e) => {
                                    this.client.handleError(e);
                                });
                            })
                            .catch((e) => {
                                this.client.handleError(e);
                            });
                    })
                    .catch(() => {
                        console.log('Could not archive the thread!');
                    })
                    .then(() => {
                        thread
                            .delete()
                            .then(() => {
                                console.log(`Deleted thread: ${thread.id}`);
                            })
                            .catch((error) => {
                                this.handleError(error);
                            });
                    })
                    .catch(() => {
                        console.log('Could not delete the thread!');
                    });
            });
    }
}
