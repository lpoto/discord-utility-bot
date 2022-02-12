import { MusicCommandOptions } from '.';
import { Command } from './command';
import {
    AudioPlayer,
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
} from '@discordjs/voice';
import { Song } from '../song';
import ytdl from 'ytdl-core';
import { ButtonInteraction } from 'discord.js';

export class Play extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    private next(interaction?: ButtonInteraction): void {
        if (!this.music.loop) {
            const s: Song | undefined | null = this.music.queue?.dequeue();
            if (s && this.music.loopQueue) this.music.queue?.enqueueSong(s);
            if (interaction)
                this.music.actions.updateQueueMessageWithInteraction(
                    interaction,
                );
            else this.music.actions.updateQueueMessage();
        }
        this.execute();
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!this.music.queue || !this.music.connection) return;
        this.music.audioPlayer = null;
        const song: Song | null = this.music.queue.head;
        if (song === null) return;

        const audioPlayer: AudioPlayer = createAudioPlayer();
        this.music.connection.subscribe(audioPlayer);

        const stream = ytdl(song.url.toString(), { filter: 'audioonly' });
        try {
            audioPlayer.play(createAudioResource(stream));
            audioPlayer
                .on(AudioPlayerStatus.Idle, () => {
                    this.next(interaction);
                })
                .on('error', () => {
                    this.next(interaction);
                });
        } catch (e) {
            console.error('Error when creating audio player');
            this.music.audioPlayer = audioPlayer;
            return;
        }
        this.music.audioPlayer = audioPlayer;
    }
}
