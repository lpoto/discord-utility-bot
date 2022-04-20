import {
    AudioPlayer,
    AudioPlayerError,
    AudioPlayerStatus,
    AudioResource,
    createAudioPlayer,
    createAudioResource,
    NoSubscriberBehavior,
    VoiceConnection,
} from '@discordjs/voice';
import { ButtonInteraction } from 'discord.js';
import { CustomAudioPlayerTrigger } from '../../';
import { Song } from '../entities';
import playdl, { YouTubeStream } from 'play-dl';

export class CustomAudioPlayer {
    private ap: AudioPlayer | undefined;
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
    private stream: YouTubeStream | undefined | null;
    private nextPlaybackDuration: number | undefined | null;

    public constructor() {
        this.ap = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Stop,
            },
        });
        this.stream = undefined;
        this.nextPlaybackDuration = undefined;
        this.offsetPlayback = 0;
        this.ap.on('error', (e) => {
            if (!this.onErrorCb) return;
            this.nextPlaybackDuration = undefined;
            this.onErrorCb(e);
            this.kill();
        });
        this.ap.on('unsubscribe', () => {
            if (!this.onUnsubscribeCb) return;
            this.nextPlaybackDuration = undefined;
            this.onUnsubscribeCb();
        });
        this.ap.on(AudioPlayerStatus.Idle, () => {
            if (!this.onIdleCb) return;
            this.offsetPlayback = 0;
            this.nextPlaybackDuration = undefined;
            this.onIdleCb();
        });
    }

    public get status(): AudioPlayerStatus {
        if (!this.ap) return AudioPlayerStatus.Idle;
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
            this.nextPlaybackDuration !== undefined &&
            this.nextPlaybackDuration !== null
        ) {
            const n: number = this.nextPlaybackDuration;
            this.nextPlaybackDuration = undefined;
            return n;
        }
        if (
            this.ap &&
            (this.ap.state.status === AudioPlayerStatus.Playing ||
                this.ap.state.status === AudioPlayerStatus.Paused ||
                this.ap.state.status === AudioPlayerStatus.Buffering)
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
        if (!this.ap) return;
        connection.removeAllListeners();
        connection.subscribe(this.ap);
    }

    public play(song: Song, startTime?: number): void {
        this.getResource(song, startTime).then((r) => {
            if (!this.ap) return;
            if (!r) {
                return;
            }
            this.ap.play(r);
        });
    }

    public pause(): boolean {
        if (this.ap) return this.ap.pause();
        return false;
    }

    public unpause(): boolean {
        if (this.ap) return this.ap.unpause();
        return false;
    }

    public setNextPlaybackDuration(seconds: number): void {
        this.nextPlaybackDuration = seconds;
    }

    public kill(): void {
        this.offsetPlayback = 0;
        this.nextPlaybackDuration = undefined;
        if (!this.ap) return;
        try {
            this.ap.removeAllListeners();
        } catch (e) {}
        try {
            if (this.ap.state.status !== AudioPlayerStatus.Idle) {
                this.ap.state.resource.audioPlayer = undefined;
                this.ap.state.resource.playStream.destroy();
                this.ap.state.resource.playStream.read();
            }
        } catch (e) {}
        try {
        } catch (e) {}
        try {
            if (this.stream) {
                this.stream.stream.destroy();
                this.stream.stream.read();
                this.stream = undefined;
            }
        } catch (e) {}
        try {
            this.ap.stop();
            this.ap = undefined;
        } catch (e) {
            this.ap = undefined;
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
        let s: number = !startTime ? 0 : startTime;
        if (s >= song.durationSeconds) s = song.durationSeconds - 3;
        if (s < 0) s = 0;

        this.stream = await playdl.stream(song.url, {
            seek: s,
        });
        return createAudioResource(this.stream.stream, {
            inputType: this.stream.type,
            inlineVolume: false,
        });
    }
}
