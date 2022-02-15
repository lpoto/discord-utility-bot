import {
    AudioPlayer,
    AudioPlayerStatus,
    VoiceConnection,
} from '@discordjs/voice';
import {
    CommandInteraction,
    Guild,
    GuildMember,
    ThreadChannel,
    VoiceChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { LanguageKeyPath } from '../translation';
import { QueueEmbed, Timer } from './models';
import { AbstractMusic, MusicActivityOptions } from './models/abstract-music';
import { SongQueue } from './models/song-queue';
import { MusicActions } from './music-actions';
import { MusicCommands } from './music-commands';

export class Music extends AbstractMusic {
    // should only be created from newMusic static method
    private musicClient: MusicClient;
    private musicGuild: Guild;
    private musicQueue: SongQueue;
    private musicThread: ThreadChannel | null;
    private musicCommands: MusicCommands;
    private player: AudioPlayer | null;
    private con: VoiceConnection | null;
    private offset: number;
    private musicTimer: Timer;

    constructor(
        client: MusicClient,
        guild: Guild,
        options?: MusicActivityOptions,
    ) {
        super(options);
        this.musicQueue = new SongQueue();
        this.musicThread = null;
        this.musicClient = client;
        this.musicGuild = guild;
        this.musicCommands = new MusicCommands(this);
        this.con = null;
        this.player = null;
        this.offset = 0;
        this.musicTimer = new Timer(
            () => {
                this.actions.updateQueueMessage();
            },
            () => {
                return (
                    this.audioPlayer?.state.status ===
                    AudioPlayerStatus.Playing
                );
            },
        );
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

    get timer(): Timer {
        return this.musicTimer;
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

    get guild(): Guild {
        return this.musicGuild;
    }

    get guildId(): string {
        return this.musicGuild.id;
    }

    get queue(): SongQueue {
        return this.musicQueue;
    }

    get queueOffset(): number {
        return this.offset;
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
        return this.client.translate(this.musicGuild.id, keys);
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

        return this.actions.replyWithQueue(interaction);
    }

    /** Create a new music object and initialize it properly.
     * Music object should always be created with this method */
    public static async newMusic(
        client: MusicClient,
        interaction: CommandInteraction,
    ): Promise<Music | null> {
        if (!interaction.guildId || !client.user || !interaction.guild)
            return null;
        const music: Music = new Music(client, interaction.guild);
        if (!music) return null;
        return music.setup(interaction).then((music2) => {
            if (music2 && music2.client && music2.guild && music2.thread)
                return music2;
            return null;
        });
    }
}
