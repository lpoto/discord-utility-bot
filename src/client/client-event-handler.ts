import {
    ButtonInteraction,
    CommandInteraction,
    DiscordAPIError,
    Guild,
    GuildMember,
    Interaction,
    Message,
    MessageAttachment,
    MessageButton,
    MessageSelectMenu,
    SelectMenuInteraction,
    TextChannel,
    ThreadChannel,
    VoiceState,
} from 'discord.js';
import { Queue } from '../entities';
import { LanguageKeyPath } from '../../';
import { MusicClient } from './client';
import fetch from 'node-fetch';
import { AudioPlayer, AudioPlayerStatus } from '@discordjs/voice';
import { EventHandlerQueue } from '../models';

export class ClientEventHandler {
    private client: MusicClient;
    private eventsQueue: EventHandlerQueue;

    public constructor(client: MusicClient) {
        this.eventsQueue = new EventHandlerQueue();
        this.client = client;
    }

    public get permissionChecker() {
        return this.client.permsChecker;
    }

    public get actions() {
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
                if (!this.client.ready) return;
                this.handleVoiceStateUpdate(voiceStatePrev, voiceStateAfter);
            },
        );

        this.client.on('error', (error: Error) => {
            this.handleError(error);
        });

        process.on('uncaughtException', (error: Error) => {
            this.handleError(error);
        });

        process.on('unhandledRejection', (error: Error) => {
            this.handleError(error);
        });

        this.client.on('interactionCreate', (interaction) => {
            if (!this.client.ready) return;
            this.handleInteraction(interaction);
        });

        this.client.on('messageCreate', (message) => {
            if (!this.client.ready) return;
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
                discordError.code &&
                [
                    '10008',
                    '50013',
                    '10003',
                    '10062',
                    '50001',
                    '40060',
                    '50083',
                    '50005',
                ].includes(discordError.code.toString())
            )
                return;
        } catch (e) {
            console.error(location ? `Error (${location}): ` : 'Error: ', e);
            return;
        }
        console.error(location ? `Error (${location}): ` : 'Error: ', error);
    }

    private async handleVoiceStateUpdate(
        voiceStatePrev: VoiceState,
        voiceStateAfter: VoiceState,
    ): Promise<void> {
        if (
            voiceStatePrev.channel?.id === voiceStateAfter.channel?.id &&
            voiceStatePrev.deaf === voiceStateAfter.deaf
        )
            return;
        const guild: Guild = voiceStateAfter.guild;
        const guildId: string = guild.id;
        if (
            voiceStateAfter.member?.id !== this.client.user?.id &&
            guild.me?.voice.channel
        ) {
            const audioPlayer: AudioPlayer | null =
                this.client.getAudioPlayer(guildId);
            if (
                (!audioPlayer ||
                    (audioPlayer.state.status !== AudioPlayerStatus.Playing &&
                        audioPlayer.state.status !==
                            AudioPlayerStatus.Paused)) &&
                voiceStateAfter.channel?.id === guild.me?.voice.channel.id &&
                ((voiceStatePrev.deaf && !voiceStateAfter.deaf) ||
                    (voiceStatePrev.channel?.id !==
                        voiceStateAfter.channel?.id &&
                        !voiceStateAfter.deaf))
            ) {
                this.client.musicActions.commands.execute('Play', guildId);
            }
            return;
        }
        if (voiceStatePrev.channel?.id === voiceStateAfter.channel?.id) return;
        if (
            (voiceStateAfter.channel?.id === undefined ||
                voiceStatePrev.channel?.id === undefined) &&
            this.client.user
        ) {
            let innactivityDc = false;
            if (voiceStateAfter.channel?.id === undefined) {
                this.client.destroyVoiceConnection(guildId);
                innactivityDc = true;
            }
            Queue.findOne({
                guildId: guildId,
                clientId: this.client.user.id,
            }).then((queue) => {
                if (queue)
                    this.actions.updateQueueMessage({
                        queue: queue,
                        innactivity: innactivityDc,
                    });
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
            message.guild &&
            message.guild.me &&
            message.member.id !== message.guild.me.id &&
            message.channel instanceof ThreadChannel &&
            message.channel.name ===
                this.translate(message.guildId, ['music', 'thread', 'name']) &&
            (message.content || message.attachments.size > 0) &&
            message.channel.ownerId === this.client.user?.id &&
            this.permissionChecker.checkMemberRoles(message.member) &&
            this.permissionChecker.validateMemberVoiceFromThread(message)
        ) {
            Queue.findOne({
                guildId: message.guildId,
                clientId: this.client.user.id,
            })
                .then(async (queue) => {
                    if (!queue) return;

                    if (
                        (message.guildId &&
                            !this.client.getVoiceConnection(
                                message.guildId,
                            )) ||
                        !message.guild?.me?.voice.channel
                    )
                        this.actions.joinVoice(null, message);

                    // get songs from message content and from all text file attachments
                    // multiple songs may be added, each in its own line

                    let songs: string[] = [];
                    if (message.content) songs = message.content.split('\n');

                    if (message.attachments.size > 0) {
                        for (let i = 0; i < message.attachments.size; i++) {
                            const file: MessageAttachment | undefined =
                                message.attachments.at(i);
                            if (!file) continue;
                            const re = await fetch(file.url);
                            if (!re.ok) continue;
                            const text: string = await re.text();
                            if (text.length === 0) continue;

                            songs = songs.concat(text.split('\n'));
                        }
                    }
                    this.actions.songsToQueue(queue, songs);
                })
                .catch((e) => this.client.handleError(e));
        }
    }

    private handleInteraction(interaction: Interaction): void {
        if (
            !interaction.guildId ||
            (!interaction.isButton() &&
                !interaction.isCommand() &&
                !interaction.isSelectMenu()) ||
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
                    this.eventsQueue.addToQueue({
                        name: 'buttonClick',
                        id: interaction.message.id,
                        callback: () => this.handleButtonClick(interaction),
                    });
                    return;
                } else if (
                    interaction.isSelectMenu() &&
                    interaction.component instanceof MessageSelectMenu
                ) {
                    this.eventsQueue.addToQueue({
                        name: 'menuSelect',
                        id: interaction.message.id,
                        callback: () => this.handleMenuSelect(interaction),
                    });
                    return;
                }
            }
            if (
                !interaction.isCommand() ||
                !interaction.guildId ||
                interaction.commandName !==
                    this.translate(interaction.guildId, [
                        'slashCommand',
                        'name',
                    ])
            )
                return;

            this.eventsQueue.addToQueue({
                name: 'slashCommand',
                id: interaction.guildId,
                callback: () => this.handleSlashCommand(interaction),
            });
        });
    }

    private async handleButtonClick(
        interaction: ButtonInteraction,
    ): Promise<void> {
        if (
            this.client.user &&
            interaction.component !== undefined &&
            interaction.guildId !== undefined &&
            interaction.guildId !== null &&
            interaction.component.label !== null &&
            interaction.component.label !== undefined
        ) {
            await Queue.findOne({
                guildId: interaction.guildId,
                clientId: this.client.user.id,
            }).then((queue) => {
                if (!queue) return;
                this.actions.executeFromInteraction(interaction);
            });
        }
    }

    private async handleMenuSelect(
        interaction: SelectMenuInteraction,
    ): Promise<void> {
        if (
            interaction.component !== undefined &&
            interaction.message &&
            interaction.guildId !== undefined &&
            this.client.user &&
            interaction.guildId !== null &&
            interaction.component.placeholder !== null &&
            interaction.component.placeholder !== undefined &&
            interaction.customId.includes('||')
        ) {
            await Queue.findOne({
                guildId: interaction.guildId,
                clientId: this.client.user.id,
            }).then((queue) => {
                if (!queue) return;
                this.actions.executeMenuSelectFromInteraction(interaction);
            });
        }
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
                                    this.actions.updateQueueMessage({
                                        queue: queue,
                                        clientRestart: true,
                                    });
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

            await Queue.findOne({
                guildId: interaction.guildId,
                clientId: this.client.user.id,
            }).then(async (queue) => {
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
                        curPageSongs: [],
                        options: [],
                        color: Math.floor(Math.random() * 16777215),
                    });

                    this.actions
                        .replyWithQueue(q, interaction)
                        .then((result) => {
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
            });
        }
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
