import {
    AudioPlayer,
    AudioPlayerStatus,
    createAudioPlayer,
    VoiceConnection,
} from '@discordjs/voice';
import { ButtonInteraction } from 'discord.js';
import { MusicClient } from '../client';
import { Queue, Song } from '../entities';
import { AbstractCommand } from '../models';

export class Play extends AbstractCommand {
    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    get description(): string | null {
        return this.translate(['music', 'commands', 'play', 'description']);
    }

    private async next(
        interaction?: ButtonInteraction,
        retries: number = 0,
        replay?: boolean,
    ): Promise<void> {
        if (!this.client.user) return;
        const queue: Queue | undefined = await Queue.findOne({
            clientId: this.client.user.id,
            guildId: this.guildId,
        });
        if (!queue) return;

        if (!replay && !queue.options.includes('loop') && retries === 0) {
            try {
                const song: Song | undefined = queue.songs.shift();
                if (song) {
                    if (queue.options.includes('loopQueue')) {
                        song.position =
                            Math.max.apply(
                                null,
                                queue.songs.map((s) => s.position),
                            ) + 1;
                        await song.save();
                    } else {
                        await song.remove();
                    }
                }
                if (interaction)
                    this.client.musicActions.updateQueueMessageWithInteraction(
                        interaction,
                        queue,
                        false,
                        false,
                        true,
                    );
                else
                    this.client.musicActions.updateQueueMessage(
                        queue,
                        true,
                        false,
                        true,
                    );
            } catch (e) {
                console.error('Error when playing next song: ', e);
            } finally {
                await queue.reload();
            }
        }

        this.execute(interaction, retries);
    }

    public async execute(
        interaction?: ButtonInteraction,
        retries: number = 0,
    ): Promise<void> {
        if (!this.client.user) return;

        const connection: VoiceConnection | null =
            this.client.getVoiceConnection(this.guildId);
        if (!connection) return;

        const queue: Queue | undefined = await Queue.findOne({
            clientId: this.client.user.id,
            guildId: this.guildId,
        });

        if (!queue || queue.songs.length < 1) return;

        const song: Song = queue.songs[0];

        let audioPlayer: AudioPlayer | null = this.client.getAudioPlayer(
            queue.guildId,
        );
        if (!audioPlayer) audioPlayer = createAudioPlayer();

        if (
            audioPlayer.state.status === AudioPlayerStatus.Playing ||
            audioPlayer.state.status === AudioPlayerStatus.Paused
        )
            return;

        this.client.setAudioPlayer(queue.guildId, audioPlayer);
        connection.removeAllListeners();
        connection.subscribe(audioPlayer);

        song.getResource()
            .then((resource) => {
                if (!resource || !audioPlayer) return;
                audioPlayer.play(resource);
                this.client.musicActions.updateQueueMessage(queue);
                audioPlayer
                    .on(AudioPlayerStatus.Idle, () => {
                        audioPlayer?.removeAllListeners();
                        this.next(interaction);
                    })
                    .on('error', (e) => {
                        audioPlayer?.removeAllListeners();
                        console.log('Error when playing: ', e);
                        this.next(interaction, retries + 1);
                    })
                    .on('unsubscribe', () => {
                        audioPlayer?.removeAllListeners();
                        console.log('Unsubscribed audio player');
                    })
                    .on('debug', (message) => {
                        if (message === 'replay' || message === 'skip') {
                            audioPlayer?.removeAllListeners();
                            audioPlayer?.stop();
                            this.client.setAudioPlayer(queue.guildId, null);
                            this.next(interaction, 0, message === 'replay');
                        }
                    });
            })
            .catch((e) => {
                console.error('Error when creating audio player: ', e);
                this.client.setAudioPlayer(queue.guildId, null);
                if (retries < 5) this.next(interaction, retries + 1);
                return;
            });
    }
}
