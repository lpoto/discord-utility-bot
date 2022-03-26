import {
    AudioPlayer,
    AudioPlayerError,
    AudioPlayerStatus,
    AudioResource,
    createAudioPlayer,
    VoiceConnection,
} from '@discordjs/voice';
import { ButtonInteraction } from 'discord.js';
import { CustomAudioPlayerTrigger } from '../../';

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

    public constructor() {
        this.ap = createAudioPlayer();
        this.ap.on('error', (e) => {
            if (!this.onErrorCb) return;
            this.onErrorCb(e);
        });
        this.ap.on('unsubscribe', () => {
            if (!this.onUnsubscribeCb) return;
            this.onUnsubscribeCb();
        });
        this.ap.on(AudioPlayerStatus.Idle, () => {
            if (!this.onIdleCb) return;
            this.onIdleCb();
        });
    }

    public get status(): AudioPlayerStatus {
        return this.ap.state.status;
    }

    public get paused(): boolean {
        return this.status === AudioPlayerStatus.Paused;
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
            this.ap.state.status === AudioPlayerStatus.Paused
        )
            return Math.round(this.ap.state.playbackDuration / 1000);
        return 0;
    }

    public subscribeToConnection(connection: VoiceConnection): void {
        connection.removeAllListeners();
        connection.subscribe(this.ap);
    }

    public play(resource: AudioResource): void {
        return this.ap.play(resource);
    }

    public pause(): boolean {
        return this.ap.pause();
    }

    public unpause(): boolean {
        return this.ap.unpause();
    }

    public kill(): void {
        try {
            this.ap.stop();
            this.ap.removeAllListeners();
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
}
