import Ffmpeg from 'fluent-ffmpeg';
import {
    AudioPlayer,
    AudioPlayerError,
    AudioPlayerStatus,
    AudioResource,
    createAudioPlayer,
    createAudioResource,
    VoiceConnection,
} from '@discordjs/voice';
import { ButtonInteraction } from 'discord.js';
import { CustomAudioPlayerTrigger } from '../../';
import { Song } from '../entities';
import ytdl from 'ytdl-core';

export class CustomAudioPlayer {
    private ap: AudioPlayer;
    private onErrorCb: ((e: AudioPlayerError) => Promise<void>) | undefined;
    private onUnsubscribeCb: (() => Promise<void>) | undefined;
    private onIdleCb: () => Promise<void> | undefined;
    private onTriggerCb:
        | ((
              trigger: CustomAudioPlayerTrigger,
              interaction?: ButtonInteraction,
          ) => Promise<void>)
        | undefined;
    private offsetPlayback: number;

    public constructor() {
        this.ap = createAudioPlayer();
        this.offsetPlayback = 0;
        this.ap.on('error', (e) => {
            if (!this.onErrorCb) return;
            this.offsetPlayback = 0;
            this.onErrorCb(e);
        });
        this.ap.on('unsubscribe', () => {
            if (!this.onUnsubscribeCb) return;
            this.onUnsubscribeCb();
        });
        this.ap.on(AudioPlayerStatus.Idle, () => {
            if (!this.onIdleCb) return;
            this.offsetPlayback = 0;
            this.onIdleCb();
        });
    }

    public get status(): AudioPlayerStatus {
        return this.ap.state.status;
    }

    public get paused(): boolean {
        return this.status === AudioPlayerStatus.Paused;
    }

    public get buffering(): boolean {
        return this.status === AudioPlayerStatus.Buffering;
    }

    public get playing(): boolean {
        return this.status === AudioPlayerStatus.Playing;
    }

    public get idle(): boolean {
        return this.status === AudioPlayerStatus.Idle;
    }

    public get playbackDuration(): number {
        if (
            this.ap.state.status === AudioPlayerStatus.Playing ||
            this.ap.state.status === AudioPlayerStatus.Paused ||
            this.ap.state.status === AudioPlayerStatus.Buffering
        ) {
            const t: number = Math.round(
                this.ap.state.resource.playbackDuration / 1000,
            );
            return t + this.offsetPlayback;
        }
        return 0;
    }

    public setOffsetPlayback(value: number) {
        this.offsetPlayback = value;
    }

    public subscribeToConnection(connection: VoiceConnection): void {
        connection.removeAllListeners();
        connection.subscribe(this.ap);
    }

    public play(song: Song, startTime?: number): void {
        this.getResource(song, startTime).then((r) => {
            if (!r) return;
            this.ap.play(r);
        });
    }

    public pause(): boolean {
        return this.ap.pause();
    }

    public unpause(): boolean {
        return this.ap.unpause();
    }

    public kill(): void {
        try {
            this.ap.removeAllListeners();
            this.ap.stop();
        } catch (e) {
            return;
        }
    }

    public onError(
        callback: (e: AudioPlayerError) => Promise<void>,
    ): CustomAudioPlayer {
        this.onErrorCb = callback;
        return this;
    }

    public onUnsubscribe(callback: () => Promise<void>): CustomAudioPlayer {
        this.onUnsubscribeCb = callback;
        return this;
    }

    public onIdle(callback: () => Promise<void>): CustomAudioPlayer {
        this.onIdleCb = callback;
        return this;
    }
    public onTrigger(
        callback: (
            t: CustomAudioPlayerTrigger,
            interaction?: ButtonInteraction,
        ) => Promise<void>,
    ): CustomAudioPlayer {
        this.onTriggerCb = callback;
        return this;
    }

    public async trigger(
        t: CustomAudioPlayerTrigger,
        interaction?: ButtonInteraction,
    ): Promise<void> {
        if (this.onTriggerCb !== undefined)
            return this.onTriggerCb(t, interaction);
    }

    public async getResource(
        song: Song,
        startTime?: number,
    ): Promise<AudioResource | null> {
        return createAudioResource(
            Ffmpeg({
                source: ytdl(song.url, {
                    filter: 'audioonly',
                    highWaterMark: 1024 * 1024 * 10,
                    quality: 'highestaudio',
                }),
            })
                .toFormat('mp3')
                .noVideo()
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .setStartTime(startTime ? startTime : 0) as any,
        );
    }
}
