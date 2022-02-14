import { AudioPlayer, VoiceConnection } from '@discordjs/voice';
import {
    CommandInteraction,
    GuildMember,
    ThreadChannel,
    VoiceChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { LanguageKeyPath } from '../translation';
import { QueueEmbed } from './models';
import { AbstractMusic, MusicActivityOptions } from './models/abstract-music';
import { SongQueue } from './models/song-queue';
import { MusicActions } from './music-actions';
import { MusicCommands } from './music-commands';

export class Music extends AbstractMusic {
    // should only be created from newMusic static method
    private musicClient: MusicClient;
    private musicGuildId: string;
    private songQueue: SongQueue | null;
    private musicThread: ThreadChannel | null;
    private musicActions: MusicActions;
    private musicCommands: MusicCommands;
    private player: AudioPlayer | null;
    private con: VoiceConnection | null;
    private offset: number;

    constructor(
        client: MusicClient,
        guildId: string,
        options?: MusicActivityOptions,
    ) {
        super(options);
        this.songQueue = null;
        this.musicThread = null;
        this.musicClient = client;
        this.musicGuildId = guildId;
        this.musicActions = new MusicActions(this);
        this.musicCommands = new MusicCommands(this);
        this.con = null;
        this.player = null;
        this.offset = 0;
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

    get actions(): MusicActions {
        return this.musicActions;
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

    get queue(): SongQueue | null {
        return this.songQueue;
    }

    get guildId(): string {
        return this.musicGuildId;
    }

    get queueOffset(): number {
        return this.offset;
    }

    public async incrementOffset(): Promise<void> {
        this.offset += QueueEmbed.songsPerPage();
    }

    public async decrementOffset(): Promise<void> {
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
                    this.startTimer();
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

        this.songQueue = new SongQueue();
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

    protected onTimerTick(): void {
        super.onTimerTick();
        if (this.totalTime > 0 && this.totalTime % 20 === 0) {
            this.musicActions.stopUpdatingQueue();
            this.musicActions = new MusicActions(this);
        }
    }
}
