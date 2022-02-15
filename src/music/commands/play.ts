import { MusicCommandOptions } from '.';
import {
    AudioPlayer,
    AudioPlayerStatus,
    createAudioPlayer,
} from '@discordjs/voice';
import { ButtonInteraction } from 'discord.js';
import { Command, Song } from '../models';

export class Play extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    get description(): string | null {
        return this.translate(['music', 'commands', 'play', 'description']);
    }

    private next(interaction?: ButtonInteraction, retries: number = 0): void {
        if (!this.music.loop && retries === 0) {
            const s: Song | undefined | null = this.music.queue.dequeue();
            if (s && this.music.loopQueue) this.music.queue.enqueueSong(s);
            if (interaction)
                this.music.actions.updateQueueMessageWithInteraction(
                    interaction,
                );
            else this.music.actions.updateQueueMessage();
        }
        this.execute(interaction, retries);
    }

    public async execute(
        interaction?: ButtonInteraction,
        retries: number = 0,
    ): Promise<void> {
        if (!this.music.connection) return;
        this.music.audioPlayer = null;
        const song: Song | null = this.music.queue.head;
        if (song === null) return;

        const audioPlayer: AudioPlayer = createAudioPlayer();
        this.music.connection.subscribe(audioPlayer);

        song.getResource()
            .then((resource) => {
                if (!resource) return;
                this.music.timer.reset();
                audioPlayer.play(resource);
                if (!this.music.timer.isActive())
                    this.music.actions.updateQueueMessage();
                audioPlayer
                    .on(AudioPlayerStatus.Idle, () => {
                        this.next(interaction);
                    })
                    .on('error', () => {
                        this.next(interaction, retries + 1);
                    });
            })
            .catch((e) => {
                console.error('Error when creating audio player: ', e);
                this.music.audioPlayer = null;
                if (retries < 5) this.next(interaction, retries + 1);
                return;
            });
        this.music.audioPlayer = audioPlayer;
    }
}
