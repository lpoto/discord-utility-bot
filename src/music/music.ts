import {
    joinVoiceChannel,
    VoiceConnection,
    VoiceConnectionStatus,
} from '@discordjs/voice';
import { randomUUID } from 'crypto';
import {
    CommandInteraction,
    Guild,
    GuildMember,
    Message,
    MessageActionRow,
    ThreadChannel,
    VoiceChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { LanguageKeyPath } from '../translation';
import { CommandName, executeCommand, getCommandsActionRow } from './commands';
import { SongQueue } from './song-queue';
import { QueueEmbed } from './utils';

export class Music {
    // should only be created from newMusic static method
    private musicClient: MusicClient;
    private musicGuildId: string;
    private queueMessage: Message | null;
    private songQueue: SongQueue | null;
    private musicThread: ThreadChannel | null;
    private offset: number;
    private con: VoiceConnection | null;
    private isLoop: boolean;
    private isLoopQueue: boolean;

    constructor(client: MusicClient, guildId: string) {
        this.queueMessage = null;
        this.songQueue = null;
        this.musicThread = null;
        this.musicClient = client;
        this.musicGuildId = guildId;
        this.con = null;
        this.isLoop = false;
        this.isLoopQueue = false;
        this.offset = 0;
    }

    get client(): MusicClient {
        return this.musicClient;
    }

    get connection(): VoiceConnection | null {
        return this.con;
    }

    get thread(): ThreadChannel | null {
        return this.musicThread;
    }

    get queue(): SongQueue | null {
        return this.songQueue;
    }

    get loop(): boolean {
        return this.isLoop;
    }

    set loop(value: boolean) {
        if (value) this.loopQueue = false;
        this.loop = value;
    }

    get queueOffset(): number {
        return this.offset;
    }

    get loopQueue(): boolean {
        return this.isLoopQueue;
    }

    set loopQueue(value: boolean) {
        if (value) this.loop = false;
        this.loop = value;
    }

    get size(): number {
        if (!this.queue) this.songQueue = new SongQueue();
        return this.queue ? this.queue.size : 0;
    }

    get message(): Message | null {
        return this.queueMessage;
    }

    get guildId(): string {
        return this.musicGuildId;
    }

    public handleError(error: Error): void {
        return this.client.handleError(error);
    }

    public incrementOffset() {
        this.offset += QueueEmbed.songsPerPage();
    }

    public decrementOffset() {
        this.offset =
            this.offset > 0 ? this.offset - QueueEmbed.songsPerPage() : 0;
    }

    public translate(keys: LanguageKeyPath) {
        return this.client.translate(this.musicGuildId, keys);
    }

    /** join the voice channel, send a queue message
     * and start a new music thread */
    public async setup(
        interaction: CommandInteraction,
    ): Promise<Music | null> {
        if (
            !interaction.member ||
            !(interaction.member instanceof GuildMember) ||
            !interaction.member.voice ||
            !interaction.member.voice.channel ||
            !(interaction.member.voice.channel instanceof VoiceChannel)
        )
            return this;
        const voiceChannel: VoiceChannel | null =
            interaction.member.voice.channel;
        const guild: Guild | null = interaction.guild;
        if (voiceChannel.full || !voiceChannel.joinable) {
            await interaction.reply({
                content: this.translate([
                    'error',
                    'voice',
                    'client',
                    'cannotJoin',
                ]),
                ephemeral: true,
            });
            return null;
        }
        return this.initializeQueueMessage(interaction).then((result) => {
            if (!result || !voiceChannel || !guild) return this;

            this.con = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfMute: true,
                selfDeaf: true,
            }).on('stateChange', (statePrev, stateAfter) => {
                if (statePrev.status === stateAfter.status) return;

                console.log(
                    `State change: ${statePrev.status} -> ${stateAfter.status}`,
                );

                if (stateAfter.status === VoiceConnectionStatus.Disconnected)
                    this.client.destroyMusic(this.guildId);
            });
            return this;
        });
    }

    public execute(commandName: CommandName): void {
        executeCommand({ name: commandName, music: this });
    }

    /** Send a new queue message and start a new music thread */
    private async initializeQueueMessage(
        interaction: CommandInteraction,
    ): Promise<boolean> {
        if (!interaction.channel || !interaction.guild) return false;

        this.songQueue = new SongQueue();
        for (let i = 0; i < 11; i++) {
            this.songQueue.enqueue(randomUUID() + randomUUID());
        }
        const embed: QueueEmbed = new QueueEmbed(this);
        const components: MessageActionRow[] = [embed.getActionRow()];
        const commandActionRow: MessageActionRow | null =
            getCommandsActionRow(this);
        if (commandActionRow) components.push(commandActionRow);
        return interaction
            .reply({
                embeds: [embed],
                fetchReply: true,
                components: components,
            })
            .then((message) => {
                if (!(message instanceof Message)) return false;

                this.queueMessage = message;
                return message
                    .startThread({
                        name: this.translate(['music', 'thread', 'name']),
                        reason: this.translate(['music', 'thread', 'reason']),
                    })
                    .then(async (thread) => {
                        if (thread) {
                            this.musicThread = thread;
                            return true;
                        }
                        message.delete().catch((error) => {
                            this.handleError(error);
                        });
                        return false;
                    })
                    .catch(() => {
                        if (!message.deletable) return false;
                        message.delete().catch((error) => {
                            this.handleError(error);
                        });
                        return false;
                    });
            })
            .catch((error) => {
                this.handleError(error);
                return false;
            });
    }

    /** Create a new music object and initialize it properly.
     * Music object should always be created with this method */
    public static async newMusic(
        client: MusicClient,
        interaction: CommandInteraction,
    ): Promise<Music | null> {
        if (!interaction.guildId || !client.user) return null;
        const music: Music = new Music(client, interaction.guildId);
        if (!music) return null;
        return music.setup(interaction).then((music2) => {
            if (
                music2 &&
                music2.client &&
                music2.guildId &&
                music2.queueMessage
            )
                return music2;
            return null;
        });
    }

    /** Archive a music thread, delete it if possible and delete
     * the queue message */
    public static async archiveMusicThread(
        thread: ThreadChannel | null,
        client: MusicClient,
    ): Promise<void> {
        if (
            !thread ||
            !thread.guild ||
            !thread.guildId ||
            !thread.parentId ||
            thread.ownerId !== client.user?.id
        )
            return;
        thread
            .fetchStarterMessage()
            .then(async (message) => {
                if (!message || !message.deletable) return;
                try {
                    await message.delete();
                } catch (error) {
                    return error;
                }
            })
            .catch((error) => {
                client.handleError(error);
            });
        thread
            .setName(
                client.translate(thread.guildId, [
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
                                client.handleError(error);
                            });
                    })
                    .catch(() => {
                        console.log('Could not delete the thread!');
                    });
            });
    }
}
