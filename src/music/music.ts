import { AudioPlayer, VoiceConnection } from '@discordjs/voice';
import {
    CommandInteraction,
    GuildMember,
    ThreadChannel,
    VoiceChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { LanguageKeyPath } from '../translation';
import { QueueEmbed, Song, Timer } from './models';
import { AbstractMusic, MusicActivityOptions } from './models/abstract-music';
import { SongQueue } from './models/song-queue';
import { MusicActions } from './music-actions';
import { MusicCommands } from './music-commands';

export class Music extends AbstractMusic {
    // should only be created from newMusic static method
    private musicClient: MusicClient;
    private musicGuildId: string;
    private queue: SongQueue | null;
    private musicThread: ThreadChannel | null;
    private musicCommands: MusicCommands;
    private player: AudioPlayer | null;
    private con: VoiceConnection | null;
    private offset: number;
    private musicTimer: Timer | null;

    constructor(
        client: MusicClient,
        guildId: string,
        options?: MusicActivityOptions,
    ) {
        super(options);
        this.queue = null;
        this.musicThread = null;
        this.musicClient = client;
        this.musicGuildId = guildId;
        this.musicCommands = new MusicCommands(this);
        this.con = null;
        this.player = null;
        this.offset = 0;
        this.musicTimer = null;
    }

    get client(): MusicClient {
        return this.musicClient;
    }

    get connection(): VoiceConnection | null {
        return this.con;
    }

    set connection(value: VoiceConnection | null) {
        this.con = value;
    }

    get timer(): Timer | null {
        return this.musicTimer;
    }

    set timer(value: Timer | null) {
        this.musicTimer = value;
    }

    get actions(): MusicActions {
        return new MusicActions(this);
    }

    get commands(): MusicCommands {
        return this.musicCommands;
    }

    get audioPlayer(): AudioPlayer | null {
        return this.player;
    }

    set audioPlayer(value: AudioPlayer | null) {
        this.player = value;
    }

    get thread(): ThreadChannel | null {
        return this.musicThread;
    }

    set thread(value: ThreadChannel | null) {
        this.musicThread = value;
    }

    get guildId(): string {
        return this.musicGuildId;
    }

    get queueOffset(): number {
        return this.offset;
    }

    public getQueueHead(): Song | null {
        if (!this.queue) return null;
        return this.queue.head;
    }

    public getAllQueueSongs(): Song[] {
        if (!this.queue) return [];
        return this.queue.allSongs;
    }

    public getQueueSize(): number {
        return this.queue ? this.queue.size : 0;
    }

    public async enqueue(name: string): Promise<void> {
        if (!this.queue) return;
        this.queueChanged = true;
        await this.queue.enqueue(name);
    }

    public enqueueSong(song: Song): void {
        if (!this.queue) return;
        this.queueChanged = true;
        this.queue.enqueueSong(song);
    }

    public async clearQueue(): Promise<void> {
        await this.queue?.clear();
    }

    public forwardQueueByIndex(idx: number): void {
        this.queue?.forwardByIndex(idx);
    }

    public removeFromQueueByIndex(idx: number): void {
        this.queue?.removeByIndex(idx);
    }

    public async shuffleQueue(): Promise<void> {
        return this.queue?.shuffle();
    }

    public dequeue(): Song | null {
        if (!this.queue) return null;
        return this.queue.dequeue();
    }

    public async incrementOffset(): Promise<void> {
        this.offsetChanged = true;
        this.offset += QueueEmbed.songsPerPage();
    }

    public async decrementOffset(): Promise<void> {
        this.offsetChanged = true;
        this.offset =
            this.offset > 0 ? this.offset - QueueEmbed.songsPerPage() : 0;
    }

    public handleError(error: Error): void {
        return this.client.handleError(error);
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
        if (
            interaction.member.voice.channel.full ||
            !interaction.member.voice.channel.joinable
        ) {
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
            if (!result) return this;
            return this.actions.joinVoice(interaction).then((result2) => {
                if (result2) {
                    return this;
                }
                return null;
            });
        });
    }

    /** Send a new queue message and start a new music thread */
    private async initializeQueueMessage(
        interaction: CommandInteraction,
    ): Promise<boolean> {
        if (!interaction.channel || !interaction.guild) return false;

        this.queue = new SongQueue();
        return this.actions.replyWithQueue(interaction);
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
            if (music2 && music2.client && music2.guildId && music2.thread)
                return music2;
            return null;
        });
    }
}
