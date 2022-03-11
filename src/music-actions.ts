import { joinVoiceChannel } from '@discordjs/voice';
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
    ThreadChannel,
} from 'discord.js';
import { UpdateQueueOptions, QueueEmbedOptions } from '../';
import { QueryFailedError } from 'typeorm';
import { MusicClient } from './client';
import { Queue, Song } from './entities';
import { QueueEmbed } from './models';
import { MusicCommands } from './music-commands';

export class MusicActions {
    private client: MusicClient;
    private musicCommands: MusicCommands;

    public constructor(client: MusicClient) {
        this.client = client;
        this.musicCommands = new MusicCommands(client);
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
            .catch((e) =>
                this.client.handleError(e, 'executing with interaction'),
            );
    }
    /**
     * Execute a command that matches the dropdown menu's custom id start
     */
    public executeMenuSelectFromInteraction(
        interaction: SelectMenuInteraction,
    ) {
        this.commands
            .executeMenuSelectFromInteraction(interaction)
            .catch((e) =>
                this.client.handleError(
                    e,
                    'executing menu select with interaction',
                ),
            );
    }

    /**
     * Search the songName on youtube and push the found songs to the queue.
     */
    public async songToQueue(queue: Queue, songName: string): Promise<number> {
        if (queue.size >= 1000) return 1000;
        const position: number = (await queue.maxPosition()) + 1;
        try {
            const songs: Song[] | null = await Song.findOnYoutube(
                songName,
                position,
            );
            if (!songs || songs.length < 1) return 1;
            for await (const s of songs) {
                s.queue = queue;
                await s.save();
                await queue.reload();
                if (queue.size >= 1000) return 1000;
            }
            return 0;
        } catch (error) {
            if (!(error instanceof QueryFailedError)) console.error(error);
            return 1;
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
                    this.client.handleError(error, 'joining voice channel');
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
                                this.client.handleError(e);
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
            if (e instanceof Error)
                this.client.handleError(e, 'actions - joinVoice');
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
                    .startThread(this.getThreadOptions(message.guildId))
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
                            this.client.handleError(
                                error,
                                'deleting message when replying with queue',
                            );
                        });
                        return false;
                    });
            })
            .catch((error) => {
                this.client.handleError(error, 'replying with queue');
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
                    this.client.handleError(error);
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
                this.client.handleError(error);
                return false;
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

    private getThreadOptions(guildId: string | null): StartThreadOptions {
        return {
            name: this.client.translate(guildId, ['music', 'thread', 'name']),
            reason: this.client.translate(guildId, [
                'music',
                'thread',
                'reason',
            ]),
        };
    }
}
