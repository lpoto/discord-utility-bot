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
    StartThreadOptions,
    ThreadChannel,
} from 'discord.js';
import { QueryFailedError } from 'typeorm';
import { MusicClient } from './client';
import { CommandName } from './commands';
import { Queue, Song } from './entities';
import { QueueEmbed } from './models';
import { MusicCommands } from './music-commands';

export class MusicActions {
    private client: MusicClient;
    private musicCommands: MusicCommands;

    constructor(client: MusicClient) {
        this.client = client;
        this.musicCommands = new MusicCommands(client);
    }

    get commands(): MusicCommands {
        return this.musicCommands;
    }

    public executeFromInteraction(interaction: ButtonInteraction) {
        this.commands.executeFromInteraction(interaction);
    }

    public async songsToQueue(
        queue: Queue,
        songNames: string[],
    ): Promise<number> {
        const player: AudioPlayer | null = this.client.getAudioPlayer(
            queue.guildId,
        );
        if (queue.songs.length >= 100) {
            if (
                !player ||
                (player &&
                    player.state.status !== AudioPlayerStatus.Playing &&
                    player.state.status !== AudioPlayerStatus.Paused)
            ) {
                await this.commands.execute(CommandName.PLAY, queue.guildId);
            }
            return 100;
        }
        let position =
            queue.songs.length > 0
                ? queue.songs[queue.songs.length - 1].position + 1
                : 0;
        let played = false;
        try {
            let exit = 0;
            let idx = 0;
            for await (const songName of songNames) {
                if (exit > 0) break;
                const songs: Song[] | null = await Song.findOnYoutube(
                    songName,
                    position,
                );
                if (!songs || songs.length < 1) return 1;
                position += songs.length;
                for await (const s of songs) {
                    s.queue = queue;
                    await s.save();
                    await queue.reload();
                    if (queue.songs.length >= 100) {
                        exit = 100;
                        break;
                    }
                }
                idx++;
                if (idx % 10 === 0 && idx < songNames.length - 1) {
                    this.updateQueueMessage(queue);
                }
                if (
                    !played &&
                    (!player ||
                        (player &&
                            player.state.status !==
                                AudioPlayerStatus.Playing &&
                            player.state.status !== AudioPlayerStatus.Paused))
                ) {
                    await this.commands.execute(
                        CommandName.PLAY,
                        queue.guildId,
                    );
                    played = true;
                }
            }
            this.updateQueueMessage(queue);
            return exit;
        } catch (error) {
            if (!(error instanceof QueryFailedError)) console.error(error);
            return 1;
        }
    }

    public async joinVoice(
        interaction: CommandInteraction | ButtonInteraction | null = null,
        message: Message | null = null,
        retry: number = 0,
    ): Promise<boolean> {
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
                this.client.handleError(error);
                if (retry < 5)
                    this.joinVoice(interaction, message, retry + 1).catch(
                        (e) => {
                            this.client.handleError(e);
                        },
                    );
            }),
        );
        return true;
    }

    public async replyWithQueue(
        queue: Queue,
        interaction: CommandInteraction,
    ): Promise<boolean> {
        const options: InteractionReplyOptions = this.getQueueOptions(queue);
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
                            this.client.handleError(error);
                        });
                        return false;
                    });
            })
            .catch((error) => {
                this.client.handleError(error);
                return false;
            });
    }

    public async updateQueueMessageWithInteraction(
        interaction: ButtonInteraction,
        queue: Queue,
        embedOnly?: boolean,
        componentsOnly?: boolean,
        reload?: boolean,
    ): Promise<boolean> {
        if (interaction.deferred || interaction.replied) return false;
        if (reload) await queue.reload();
        return interaction
            .update(this.getQueueOptions(queue, embedOnly, componentsOnly))
            .then(() => {
                return true;
            })
            .catch((error) => {
                this.client.handleError(error);
                return false;
            });
    }

    public async updateQueueMessage(
        queue: Queue,
        embedOnly?: boolean,
        componentsOnly?: boolean,
        reload?: boolean,
    ): Promise<boolean> {
        const guild: Guild = await this.client.guilds.fetch(queue.guildId);
        if (!guild) return false;
        const channel: NonThreadGuildBasedChannel | null =
            await guild.channels.fetch(queue.channelId);
        if (!channel || !channel.isText()) return false;
        const thread: ThreadChannel | null = await channel.threads.fetch(
            queue.threadId,
        );
        if (!thread) return false;
        if (reload) await queue.reload();
        return thread
            .fetchStarterMessage()
            .then((message) => {
                if (!message) return false;
                return message
                    .edit(
                        this.getQueueOptions(queue, embedOnly, componentsOnly),
                    )
                    .then(() => {
                        return true;
                    });
            })
            .catch((error) => {
                this.client.handleError(error);
                return false;
            });
    }

    private getQueueOptions(
        queue: Queue,
        embedOnly?: boolean,
        componentsOnly?: boolean,
    ): InteractionReplyOptions {
        if (embedOnly) {
            return {
                embeds: [new QueueEmbed(this.client, queue)],
            };
        }
        const components: MessageActionRow[] = [];
        let commandActionRow: MessageActionRow[] = [];
        commandActionRow = commandActionRow.concat(
            this.musicCommands.getCommandsActionRow(queue),
        );
        for (const row of commandActionRow) components.push(row);
        if (componentsOnly) {
            return {
                components: components,
            };
        }
        return {
            embeds: [new QueueEmbed(this.client, queue)],
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
