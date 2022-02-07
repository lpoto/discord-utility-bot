import { Guild, NonThreadGuildBasedChannel, VoiceChannel } from 'discord.js';
import { MusicClient } from '../client';

export class Music {
    private client: MusicClient;
    private ready = false;
    private guild: Guild | null = null;
    private channel: VoiceChannel | null = null;
    private headSong: Song | null = null;
    private tailSong: Song | null = null;
    private songCount = 0;
    private paused = false;
    private loop = false;
    private loopQueue = false;

    constructor(client: MusicClient, guildId: string, channelId: string) {
        this.client = client;
        this.client.guilds.fetch(guildId).then((guild: Guild) => {
            if (!this.guild) return;
            this.guild = guild;
            this.guild.channels
                .fetch(channelId)
                .then((channel: NonThreadGuildBasedChannel | null) => {
                    if (!channel) return;
                    if (channel instanceof VoiceChannel) {
                        this.channel = channel;
                        this.ready = true;
                    }
                    return;
                });
        });
    }

    get isReady() {
        return this.ready;
    }

    get SongCount() {
        return this.songCount;
    }

    get Loop() {
        return this.loop;
    }

    get LoopQueue() {
        return this.loopQueue;
    }

    public changeChannel(newChannel: VoiceChannel) {
        if (!this.ready) return;
        this.channel = newChannel;
    }

    public addSong(songName: string, pushForward: boolean, skip: boolean) {
        if (!this.ready) return;
        const song = this.findSong(songName);
        if (!song) return;
        this.enqueueSong(song, pushForward, skip);
    }

    public shuffle(): void {
        if (!this.ready) return;
        // shove songs into an array
        // shuffle the array
        // change the array back to linked list
        return;
    }

    public clearQueue(): void {
        this.songCount = 0;
        this.headSong = null;
        this.tailSong = null;
    }

    public stopPlaying(): void {}

    public pauseResume(): void {}

    public skip(): void {
        this.playNextSong();
    }

    private enqueueSong(
        song: Song,
        pushForward: boolean = false,
        skip: boolean = false,
    ): void {
        // if pushForward, add song to the head of the queue
        // if skip, skip the current song
        if (pushForward) {
            const temp: Song | null = this.headSong;
            this.headSong = song;
            this.headSong.Next = temp;
            if (skip) {
                this.skip();
                return;
            }
        } else {
            if (!this.tailSong || !this.headSong) {
                this.headSong = song;
                this.tailSong = this.headSong;
                this.songCount = 1;
            } else if (this.tailSong) {
                this.tailSong.Next = song;
                this.tailSong = this.tailSong.Next;
                this.songCount++;
            } else return;
        }
        if (!this.paused && this.songCount === 1) this.startPlaying();
    }

    private dequeueSong(): Song | null {
        if (!this.headSong) return null;
        const song: Song = this.headSong;
        this.headSong = this.headSong.Next;
        this.songCount--;
        return song;
    }

    private joinChannel(): void {}

    private leaveChannel(): void {}

    private playNextSong(): void {}

    private startPlaying(): void {}

    private findSong(songName: string): Song | null {
        if (!this.ready) return null;
        return null;
    }
}

class Song {
    private next: Song | null;
    private name: string;
    private duration: number;

    constructor() {
        this.next = null;
    }

    get Next(): Song | null {
        return this.next;
    }

    set Next(next: Song | null) {
        this.next = next;
    }
}
