import {
    AudioPlayer,
    AudioPlayerStatus,
    createAudioPlayer,
    VoiceConnection,
} from '@discordjs/voice';
import {
    ButtonInteraction,
    Guild,
    Message,
    NonThreadGuildBasedChannel,
    VoiceChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { Queue, Song, QueueOption } from '../entities';
import { AbstractCommand, SongFinder, SongTimer } from '../utils';

export class Play extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string | null {
        return this.translate(['music', 'commands', 'play', 'description']);
    }

    private async next(
        interaction?: ButtonInteraction,
        error?: boolean,
        retries: number = 0,
    ): Promise<void> {
        if (!this.client.user) return;
        if (retries >= 5) return;
        let queue: Queue | undefined = await Queue.findOne({
            clientId: this.client.user.id,
            guildId: this.guildId,
        }).catch((e) => {
            this.client.emitEvent('error', e);
            return undefined;
        });
        if (!queue) return;
        try {
            /*
             * Determine if a song needs to be removed from the queue,
             * pushed to the back of the queue or nothing at all.
             */
            if (error || !queue.hasOption(QueueOption.Options.LOOP))
                queue = await queue.removeHeadSong(true);

            this.execute(interaction).catch((e) => {
                this.client.emit('error', e);
                if (queue)
                    this.client.emitEvent('queueMessageUpdate', {
                        queue: queue,
                        interaction: interaction,
                        timeout: 300,
                    });
                this.next(interaction, true, retries + 1);
            });
        } catch (e) {
            if (e instanceof Error) this.client.emitEvent('error', e);
            if (retries === 0)
                this.client.emitEvent('queueMessageUpdate', {
                    queue: queue,
                    interaction: interaction,
                    timeout: 300,
                });
            this.next(interaction, error, retries + 1);
        }
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

        if (!queue) return;

        if (!queue.headSong) {
            this.client.emitEvent('queueMessageUpdate', {
                queue: queue,
                interaction: interaction,
                timeout: 300,
            });
            return;
        }

        // play music when at least one (non bot) listener (unmuted)
        // music is auto started when first user joins or unmutes
        const guild: Guild | void = await this.client.guilds
            .fetch(queue.guildId)
            .catch((e) => {
                this.client.emitEvent('error', e);
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
            this.client.emitEvent('queueMessageUpdate', {
                queue: queue,
                timeout: 300,
            });
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

                const timer: SongTimer = new SongTimer(
                    this.client,
                    this.guildId,
                    song.durationSeconds,
                    interaction?.message instanceof Message
                        ? interaction.message
                        : undefined,
                );

                timer?.start();

                this.client.emitEvent('queueMessageUpdate', {
                    queue: queue,
                    timeout: 250,
                    doNotSetUpdated: true,
                });
                audioPlayer.play(resource);
                audioPlayer
                    .on(AudioPlayerStatus.Idle, () => {
                        // when the songs stops playing
                        timer?.stop();
                        audioPlayer?.removeAllListeners();
                        audioPlayer?.stop();
                        this.next(interaction);
                    })
                    .on('error', async (e) => {
                        /* on error remove all occurances of the song
                         * that threw error from the queue */
                        console.log('Error when playing: ', e?.message);
                        timer?.stop();
                        audioPlayer?.removeAllListeners();
                        audioPlayer?.stop();
                        const q: Queue | undefined = await this.getQueue();
                        if (!q || q.curPageSongs.length === 0) return;
                        const url: string = q.curPageSongs[0].url;
                        q.curPageSongs = q.curPageSongs.filter(
                            (s) => s.url !== url,
                        );
                        await q.save();
                        this.next(interaction, true);
                    })
                    .on('unsubscribe', () => {
                        timer?.stop();
                        audioPlayer?.removeAllListeners();
                        console.log('Unsubscribed audio player');
                    })
                    .on('debug', (message) => {
                        // replay and skip commands emit debug messages
                        // ('skip' and 'replay')
                        if (['replay', 'skip', 'previous'].includes(message)) {
                            timer?.stop();
                            audioPlayer?.removeAllListeners();
                            audioPlayer?.stop();
                            this.client.setAudioPlayer(queue.guildId, null);
                            if (message === 'skip') this.next(interaction);
                            else this.execute(interaction);
                        }
                    });
            })
            .catch((e) => {
                this.client.emitEvent('error', e);
                this.client.setAudioPlayer(queue.guildId, null);
                return;
            });
    }
}
