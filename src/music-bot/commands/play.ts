import { VoiceConnection } from '@discordjs/voice';
import {
    ButtonInteraction,
    Guild,
    Message,
    MessageAttachment,
    NonThreadGuildBasedChannel,
    VoiceChannel,
} from 'discord.js';
import fetch from 'node-fetch';
import { CustomAudioPlayerTrigger } from '../music-bot';
import { MusicClient } from '../client';
import { Queue, Song } from '../entities';
import { AbstractCommand, CustomAudioPlayer, SongTimer } from '../utils';

export class Play extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string | null {
        return this.translate(['music', 'commands', 'play', 'description']);
    }

    public get additionalHelp(): string | null {
        return this.translate(['music', 'commands', 'play', 'additionalHelp']);
    }

    public get reggex(): RegExp | null {
        return /^!(((p(lay)?)|(add))?((n(ow)?)|(f(ront)?))(\s+))/i;
    }

    private async next(
        interaction?: ButtonInteraction,
        error?: boolean,
        retries: number = 0,
        count?: number,
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
            if (!count) count = 1;
            if (count > queue.size) count = queue.size;
            queue = await queue.removeHeadSongs(count);

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

    public async execute(
        interaction?: ButtonInteraction,
        startTime?: number,
    ): Promise<void> {
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
            await queue.reload();
            this.client.emitEvent('queueMessageUpdate', {
                queue: queue,
                interaction: interaction,
                timeout: 300,
            });
            if (!queue.headSong) return;
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
                interaction: interaction,
                timeout: 300,
            });
            return;
        }

        const song: Song = queue.headSong;

        /* Remove listeners from old audioPlayer (if exists) and create
         * a new one. Return if audioPlayer is already playing or paused */
        let audioPlayer: CustomAudioPlayer | null = this.client.getAudioPlayer(
            queue.guildId,
        );
        if (!audioPlayer) audioPlayer = new CustomAudioPlayer();

        if (audioPlayer.paused || audioPlayer.playing) return;

        this.client.setAudioPlayer(queue.guildId, audioPlayer);
        try {
            audioPlayer.subscribeToConnection(connection);

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
                interaction: interaction,
                doNotSetUpdated: true,
            });
            if (startTime !== undefined && startTime < 0)
                startTime = undefined;
            if (startTime !== undefined && startTime >= song.durationSeconds)
                startTime = song.durationSeconds - 3;
            if (startTime !== undefined) {
                audioPlayer.setOffsetPlayback(startTime);
                audioPlayer.setNextPlaybackDuration(startTime);
            }
            this.client.logger.debug(
                `Playing song '${song.shortName}' in guild ${queue.guildId}`,
                !startTime ? '' : ` with offset ${startTime}s`,
            );
            audioPlayer.play(song, startTime);
            audioPlayer
                .onIdle(async () => {
                    // when the songs stops playing
                    timer?.stop();
                    audioPlayer?.kill();
                    this.client.setAudioPlayer(queue.guildId, null);
                    this.client.logger.debug(
                        `Song '${queue.headSong?.shortName}' finished playing in guild '${queue.guildId}'`,
                    );
                    this.next(interaction);
                })
                .onError(async (e) => {
                    /* on error remove all occurances of the song
                     * that threw error from the queue */
                    this.client.logger.warn(
                        'Error when playing: ',
                        e?.message,
                    );
                    timer?.stop();
                    audioPlayer?.kill();
                    this.client.setAudioPlayer(queue.guildId, null);
                    const q: Queue | undefined = await this.getQueue();
                    if (!q || q.curPageSongs.length === 0) return;
                    const url: string = q.curPageSongs[0].url;
                    q.curPageSongs = q.curPageSongs.filter(
                        (s) => s.url !== url,
                    );
                    await q.save();
                    this.next(interaction, true);
                })
                .onUnsubscribe(async () => {
                    timer?.stop();
                    audioPlayer?.kill();
                    this.client.setAudioPlayer(queue.guildId, null);
                    this.client.logger.debug(
                        `Unsubscribed audio player in guild '${queue.guildId}'`,
                    );
                })
                .onTrigger(
                    async (
                        t: CustomAudioPlayerTrigger,
                        i?: ButtonInteraction,
                        n?: number,
                    ) => {
                        const d: number = audioPlayer
                            ? audioPlayer.playbackDuration
                            : 0;
                        timer?.stop();
                        audioPlayer?.kill();
                        this.client.setAudioPlayer(queue.guildId, null);
                        if (t === 'jumpForward')
                            return this.execute(
                                i,
                                d + (n !== undefined ? n : 20),
                            );
                        if (t === 'jumpBackward')
                            return this.execute(
                                i,
                                d - (n !== undefined ? n : 20) > 0
                                    ? d - (n !== undefined ? n : 20)
                                    : 0,
                            );
                        if (t === 'skip')
                            return this.next(i, undefined, undefined, n);
                        return this.execute(i);
                    },
                );
        } catch (e) {
            if (e instanceof Error) this.client.emitEvent('error', e);
            this.client.setAudioPlayer(queue.guildId, null);
            return;
        }
    }

    public async executeFromReggex(message: Message): Promise<void> {
        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        const content: string = message.content
            .replace(message.content.split(/\s+/)[0], '')
            .trim();
        let songs: string[] = content.split('\n');

        if (message.attachments.size > 0) {
            for (let i = 0; i < message.attachments.size; i++) {
                const file: MessageAttachment | undefined =
                    message.attachments.at(i);
                if (!file) continue;
                const re = await fetch(file.url);
                if (!re.ok) continue;
                const text: string = await re.text();
                if (text.length === 0) continue;

                songs = songs.concat(text.split('\n'));
            }
        }

        this.client.emitEvent('newSong', {
            guildId: queue.guildId,
            songNames: songs,
            toFront: true,
        });
    }
}
