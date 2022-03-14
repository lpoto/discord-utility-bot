import {
    AudioPlayer,
    AudioPlayerStatus,
    createAudioPlayer,
    VoiceConnection,
} from '@discordjs/voice';
import {
    ButtonInteraction,
    Guild,
    NonThreadGuildBasedChannel,
    VoiceChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { Queue, Song, QueueOption } from '../entities';
import { AbstractCommand, SongFinder } from '../utils';

export class Play extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string | null {
        return this.translate(['music', 'commands', 'play', 'description']);
    }

    private async next(
        interaction?: ButtonInteraction,
        replay?: boolean,
        error?: boolean,
    ): Promise<void> {
        if (!this.client.user) return;
        let queue: Queue | undefined = await Queue.findOne({
            clientId: this.client.user.id,
            guildId: this.guildId,
        });
        if (!queue) return;

        /*
         * Determine if a song needs to be removed from the queue,
         * pushed to the back of the queue or nothing at all.
         */
        if (error || (!replay && !queue.hasOption(QueueOption.Options.LOOP))) {
            const headSong: Song | undefined = queue.headSong;
            if (
                !error &&
                headSong &&
                queue.hasOption(QueueOption.Options.LOOP_QUEUE)
            ) {
                const song: Song = Song.create({
                    url: headSong.url,
                    name: headSong.name,
                    durationString: headSong.durationString,
                    durationSeconds: headSong.durationSeconds,
                    queue: queue,
                });
                await song.generatePosition();
                await song.save();
            }
            if (headSong) {
                await headSong.remove();
                await queue.reload();
            }
        }

        queue.color = Math.floor(Math.random() * 16777215);
        queue = await queue.save();

        this.client.musicActions.updateQueueMessage({
            queue: queue,
            interaction: interaction,
        });

        this.execute(interaction);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!this.client.user) return;

        const connection: VoiceConnection | null =
            this.client.getVoiceConnection(this.guildId);
        if (!connection) return;

        const queue: Queue | undefined = await Queue.findOne({
            clientId: this.client.user.id,
            guildId: this.guildId,
        });

        if (!queue || !queue.headSong) return;

        // play music when at least one (non bot) listener (unmuted)
        // music is auto started when first user joins or unmutes
        const guild: Guild | void = await this.client.guilds
            .fetch(queue.guildId)
            .catch((e) => {
                this.client.emit('error', e);
            });
        if (!guild || !this.connection?.joinConfig.channelId) return;
        const channel: NonThreadGuildBasedChannel | null =
            await guild.channels.fetch(this.connection?.joinConfig.channelId);
        if (
            !channel ||
            !(channel instanceof VoiceChannel) ||
            channel.members.filter((m) => !m.user.bot && !m.voice.deaf)
                .size === 0
        ) {
            // update queue message even if no member listeners
            this.client.musicActions.updateQueueMessage({ queue: queue });
            return;
        }

        const song: Song = queue.headSong;

        /* Remove listeners from old audioPlayer (if exists) and create
         * a new one. Return if audioPlayer is already playing or paused */
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

        SongFinder.getResource(song)
            .then((resource) => {
                if (!resource || !audioPlayer) return;
                this.client.musicActions.updateQueueMessage({ queue: queue });
                audioPlayer.play(resource);
                audioPlayer
                    .on(AudioPlayerStatus.Idle, () => {
                        // when the songs stops playing
                        audioPlayer?.removeAllListeners();
                        audioPlayer?.stop();
                        this.next(interaction);
                    })
                    .on('error', (e) => {
                        /* on error remove all occurances of the song
                         * that threw error from the queue */
                        audioPlayer?.removeAllListeners();
                        audioPlayer?.stop();
                        this.getQueue().then((q) => {
                            if (!q || q.curPageSongs.length === 0) return;
                            const url: string = q.curPageSongs[0].url;
                            q.curPageSongs = q.curPageSongs.filter(
                                (s) => s.url !== url,
                            );
                            q.save().then(() => {
                                this.next(interaction);
                            });
                        });
                        console.log('Error when playing: ', e?.message);
                        // try to play the song next in queue
                        this.next(interaction, false, true);
                    })
                    .on('unsubscribe', () => {
                        audioPlayer?.removeAllListeners();
                        console.log('Unsubscribed audio player');
                    })
                    .on('debug', (message) => {
                        // replay and skip commands emit debug messages
                        // ('skip' and 'replay')
                        if (message === 'replay' || message === 'skip') {
                            audioPlayer?.removeAllListeners();
                            audioPlayer?.stop();
                            this.client.setAudioPlayer(queue.guildId, null);
                            this.next(interaction, message === 'replay');
                        }
                    });
            })
            .catch((e) => {
                this.client.emit('error', e);
                this.client.setAudioPlayer(queue.guildId, null);
                return;
            });
    }
}
