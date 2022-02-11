import { MusicCommandOptions } from '.';
import { Command } from './command';
import {AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource} from '@discordjs/voice';
import { Song } from '../song';
import ytdl from 'ytdl-core';
import { ButtonInteraction } from 'discord.js';

export class Play extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!this.music.queue || !this.music.connection) return;
        this.music.audioPlayer = null;
        const song: Song | null = this.music.queue.head;
        if (song === null) return;

        const audioPlayer: AudioPlayer = createAudioPlayer();
        this.music.connection.subscribe(audioPlayer);
        
        const stream = ytdl(song.url.toString(), { filter: 'audioonly'});
        audioPlayer.play(createAudioResource(stream))
        audioPlayer.on(AudioPlayerStatus.Idle, () => {
            if (!this.music.loop) {
                const s: Song | undefined | null= this.music.queue?.dequeue();
                if (s && this.music.loopQueue)
                    this.music.queue?.enqueueSong(s);
                this.music.actions.updateQueueMessage();
            }
            this.execute();
        })
        this.music.audioPlayer = audioPlayer;
    }

}
