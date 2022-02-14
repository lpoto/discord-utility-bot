import { MusicCommandOptions } from '.';
import {
    AudioPlayer,
    AudioPlayerStatus,
    createAudioPlayer,
} from '@discordjs/voice';
import { ButtonInteraction } from 'discord.js';
import { Command, Song, Timer } from '../models';

export class Play extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    get description(): string | null {
        return this.translate(['music', 'commands', 'play', 'description']);
    }

    private next(interaction?: ButtonInteraction, retries: number = 0): void {
        if (!this.music.loop) {
            const s: Song | undefined | null = this.music.dequeue();
            if (s && this.music.loopQueue) this.music.enqueueSong(s);
            if (interaction)
                this.music.actions.updateQueueMessageWithInteraction(
                    interaction,
                );
            else this.music.actions.updateQueueMessage();
        }
        this.music.timer?.stop();
        this.music.timer = null;
        this.music.playing = false;
        this.execute(interaction, retries);
    }

    public async execute(
        interaction?: ButtonInteraction,
        retries: number = 0,
    ): Promise<void> {
        if (!this.music.connection) return;
        this.music.audioPlayer = null;
        const song: Song | null = this.music.getQueueHead();
        if (song === null) return;

        this.music.timer = new Timer(this.music, song.seconds, 3, () => {
            this.music.actions.updateQueueMessage();
        });

        const audioPlayer: AudioPlayer = createAudioPlayer();
        this.music.connection.subscribe(audioPlayer);

        song.getResource()
            .then((resource) => {
                if (!resource) return;
                this.music.playing = true;
                this.music.timer?.start();
                audioPlayer.play(resource);
                audioPlayer
                    .on(AudioPlayerStatus.Idle, () => {
                        this.music.playing = false;
                        this.next(interaction);
                    })
                    .on('error', () => {
                        this.music.playing = false;
                        this.next(interaction);
                    });
            })
            .catch((e) => {
                console.error('Error when creating audio player: ', e);
                this.music.timer?.stop();
                this.music.timer = null;
                this.music.audioPlayer = null;
                this.music.playing = false;
                if (retries < 5) this.next(interaction, retries + 1);
                return;
            });
        this.music.audioPlayer = audioPlayer;
    }
}
