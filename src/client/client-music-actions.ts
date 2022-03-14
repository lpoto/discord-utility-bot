import {
    AudioPlayer,
    AudioPlayerStatus,
    joinVoiceChannel,
} from '@discordjs/voice';
import {
    ButtonInteraction,
    CommandInteraction,
    Guild,
    GuildMember,
    InteractionReplyOptions,
    Message,
    MessageActionRow,
    NonThreadGuildBasedChannel,
    SelectMenuInteraction,
    StartThreadOptions,
    TextChannel,
    ThreadChannel,
} from 'discord.js';
import { UpdateQueueOptions, QueueEmbedOptions } from '../../';
import { MusicClient } from '../client';
import { Queue, Song } from '../entities';
import { QueueEmbed, SongFinder } from '../utils';
import { MusicCommands } from './client-music-commands';

export class MusicActions {
    private client: MusicClient;
    private musicCommands: MusicCommands;
    private songsToUpdateCount: {
        [guildId: string]: { [key in 'toUpdate' | 'updated']: number };
    };
    private songsToUpdate: {
        [guildId: string]: Song[];
    };

    public constructor(client: MusicClient) {
        this.client = client;
        this.musicCommands = new MusicCommands(client);
        this.songsToUpdateCount = {};
        this.songsToUpdate = {};
    }

    public get commands(): MusicCommands {
        return this.musicCommands;
    }

    /**
     * Execute a command that matches the button's label.
     */
    public executeFromInteraction(interaction: ButtonInteraction) {
        this.commands
            .executeFromInteraction(interaction)
            .catch((e) => this.client.emit('error', e));
    }
    /**
     * Execute a command that matches the dropdown menu's custom id start
     */
    public executeMenuSelectFromInteraction(
        interaction: SelectMenuInteraction,
    ) {
        this.commands
            .executeMenuSelectFromInteraction(interaction)
            .catch((e) => this.client.emit('error', e));
    }

    /**
     * Search the songs on youtube and push them to the queue.
     */
    public songsToQueue(queue: Queue, songs: string[]): void {
        // limit songs
        if (queue.size >= 20000 || queue.size + songs.length > 25000) return;

        if (
            !(queue.guildId in this.songsToUpdateCount) ||
            this.songsToUpdateCount[queue.guildId].toUpdate === undefined ||
            this.songsToUpdateCount[queue.guildId].updated === undefined
        ) {
            this.songsToUpdateCount[queue.guildId] = {
                toUpdate: 0,
                updated: 0,
            };
        }

        this.songsToUpdateCount[queue.guildId].toUpdate += songs.length;

        for (let i = 0; i < songs.length; i++) {
            /* filter songs, if both name and url provided, extract url
             * else it will be determined when fetchign songs from youtube
             * */
            const s: string = songs[i];
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
            new SongFinder(n).getSongs().then((songs2) => {
                if (songs2 && songs2.length > 0) {
                    if (!(queue.guildId in this.songsToUpdate))
                        this.songsToUpdate[queue.guildId] = [];
                    for (const s2 of songs2) {
                        this.songsToUpdate[queue.guildId].push(s2);
                    }
                    this.checkIfNeedsUpdate(queue.guildId, songs2.length);
                }
            });
        }
    }

    private checkIfNeedsUpdate(guildId: string, add?: number): void {
        if (
            !this.client.user ||
            !this.songsToUpdateCount[guildId] ||
            this.songsToUpdateCount[guildId].updated === undefined
        )
            return;
        if (add) this.songsToUpdateCount[guildId].updated += add;
        const updateAndDelete: boolean =
            this.songsToUpdateCount[guildId].updated ===
            this.songsToUpdateCount[guildId].toUpdate;
        const onlyUpdate: boolean = updateAndDelete
            ? false
            : (this.songsToUpdateCount[guildId].updated + 1) % 100 === 0;
        if (updateAndDelete || onlyUpdate) {
            if (updateAndDelete) delete this.songsToUpdateCount[guildId];
            if (!(guildId in this.songsToUpdate))
                this.songsToUpdate[guildId] = [];
            Song.saveAll(
                this.songsToUpdate[guildId],
                guildId,
                this.client.user.id,
            ).then(() => {
                if (!this.client.user) return;
                Queue.findOne({
                    guildId: guildId,
                    clientId: this.client.user.id,
                }).then((queue) => {
                    if (!queue) return;
                    const audioPlayer: AudioPlayer | null =
                        this.client.getAudioPlayer(guildId);
                    if (
                        !audioPlayer ||
                        (audioPlayer.state.status !==
                            AudioPlayerStatus.Playing &&
                            audioPlayer.state.status !==
                                AudioPlayerStatus.Paused)
                    ) {
                        this.commands.execute('Play', guildId);
                    }
                    this.updateQueueMessage({ queue: queue });
                });
            });
            delete this.songsToUpdate[guildId];
        }
    }

    /**
     * Try to join the voice channel of the interaction member.
     */
    public async joinVoice(
        interaction:
            | CommandInteraction
            | ButtonInteraction
            | SelectMenuInteraction
            | null = null,
        message: Message | null = null,
    ): Promise<boolean> {
        try {
            let voiceChannelId: string;
            let guild: Guild;
            if (
                interaction &&
                interaction.member instanceof GuildMember &&
                interaction.member.voice.channel &&
                interaction.guild
            ) {
                voiceChannelId = interaction.member.voice.channel.id;
                guild = interaction.guild;
            } else if (
                message &&
                message.member &&
                message.member.voice.channel &&
                message.guild
            ) {
                voiceChannelId = message.member.voice.channel.id;
                guild = message.guild;
            } else {
                return false;
            }
            this.client.setVoiceConnection(
                guild.id,
                joinVoiceChannel({
                    channelId: voiceChannelId,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                    selfMute: false,
                    selfDeaf: true,
                }).on('error', (error) => {
                    this.client.emit('error', error);
                    if (interaction) {
                        interaction
                            .reply({
                                content: this.client.translate(guild.id, [
                                    'error',
                                    'voice',
                                    'failedJoining',
                                ]),
                                ephemeral: true,
                            })
                            .catch((e) => {
                                this.client.emit('error', e);
                            });
                    } else if (message) {
                        message.reply({
                            content: this.client.translate(guild.id, [
                                'error',
                                'voice',
                                'failedJoining',
                            ]),
                        });
                    }
                }),
            );
        } catch (e) {
            if (e instanceof Error) this.client.emit('error', e);
            else console.error('Error when joining voice: ', e);
        }
        return true;
    }

    /**
     * Reply to an interaction with a default queue.
     */
    public async replyWithQueue(
        queue: Queue,
        interaction: CommandInteraction,
    ): Promise<boolean> {
        const options: InteractionReplyOptions = this.getQueueOptions({
            queue: queue,
            interaction: interaction,
        });
        return interaction
            .reply({
                fetchReply: true,
                embeds: options.embeds,
                components: options.components,
            })
            .then((message) => {
                if (!(message instanceof Message)) return false;
                return message
                    .startThread(this.getThreadOptions())
                    .then(async (thread) => {
                        if (thread && message.guildId && message.channelId) {
                            return this.joinVoice(interaction)
                                .then((result) => {
                                    if (!result || !message.guildId)
                                        return false;
                                    queue.messageId = message.id;
                                    queue.threadId = thread.id;
                                    queue.channelId = message.channelId;
                                    queue.guildId = message.guildId;
                                    return true;
                                })
                                .catch((e) => {
                                    console.error(
                                        'Error when joining voice: ',
                                        e,
                                    );
                                    return false;
                                });
                        }
                        message.delete().catch((error) => {
                            this.client.emit('error', error);
                        });
                        return false;
                    });
            })
            .catch((error) => {
                this.client.emit('error', error);
                return false;
            });
    }

    /**
     * Update queue message based on the fetched Queue entity.
     * Update interaction if interaction given, else fetch message from
     * Queue's messageId.
     */
    public async updateQueueMessage(
        options: UpdateQueueOptions,
    ): Promise<boolean> {
        const queue: Queue = options.queue;
        if (options.reload) await queue.reload();
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
                    return true;
                })
                .catch((error) => {
                    this.client.emit('error', error);
                    return false;
                });
        }
        const guild: Guild = await this.client.guilds.fetch(queue.guildId);
        if (!guild) return false;
        const channel: NonThreadGuildBasedChannel | null =
            await guild.channels.fetch(queue.channelId);
        if (!channel || !channel.isText()) return false;
        const thread: ThreadChannel | null = await channel.threads.fetch(
            queue.threadId,
        );
        if (!thread) return false;
        return thread
            .fetchStarterMessage()
            .then((message) => {
                if (!message) return false;
                return message.edit(this.getQueueOptions(options)).then(() => {
                    return true;
                });
            })
            .catch((error) => {
                this.client.emit('error', error);
                return false;
            });
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
                            if (thread)
                                this.client.utilityActions.archiveMusicThread(
                                    thread,
                                );
                        })
                        .catch((e) => {
                            this.client.emit('error', e);
                            channel.messages
                                .fetch(result.messageId)
                                .then((msg) => {
                                    if (!msg || !msg.deletable) return;
                                    msg.delete().catch((e2) => {
                                        this.client.emit('error', e2);
                                    });
                                })
                                .catch((e2) => {
                                    this.client.emit('error', e2);
                                });
                        });
                })
                .catch((error) => {
                    this.client.emit('error', error);
                });
            Queue.remove(result);
            this.client.destroyVoiceConnection(guildId);
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
            this.musicCommands.getCommandsActionRow(options.queue),
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

    private getThreadOptions(): StartThreadOptions {
        return {
            name: this.client.translate(null, ['music', 'thread', 'name']),
            reason: this.client.translate(null, ['music', 'thread', 'reason']),
        };
    }
}
