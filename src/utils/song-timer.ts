import { AudioPlayer, AudioPlayerStatus } from '@discordjs/voice';
import { Guild, Message, TextChannel } from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';

export class SongTimer {
    private message: Message | undefined;
    private timer: NodeJS.Timer;
    private isAlive: boolean;
    private client: MusicClient;
    private guildId: string;
    private canUpdate: boolean;

    public constructor(
        client: MusicClient,
        guildId: string,
        message?: Message,
    ) {
        this.message = message;
        this.client = client;
        this.guildId = guildId;
        this.canUpdate = true;
    }

    public start(): void {
        if (!this.guildId) return;
        this.isAlive = true;
        this.timer = setInterval(async () => {
            try {
                if (!this.isAlive || !this.client.user) return this.stop();

                if (!this.canUpdate) return;
                this.canUpdate = false;

                const queue: Queue | undefined = await Queue.findOne({
                    guildId: this.guildId,
                    clientId: this.client.user.id,
                });

                if (!queue) return this.stop();
                if (!this.message) this.message = await this.getMessage(queue);
                if (!this.message || !this.guildId) return this.stop();
                const audioPlayer: AudioPlayer | null =
                    this.client.getAudioPlayer(this.guildId);

                if (!audioPlayer) return this.stop();
                if (audioPlayer.state.status === AudioPlayerStatus.Paused)
                    return;
                if (audioPlayer.state.status !== AudioPlayerStatus.Playing)
                    return;

                this.client.emitEvent('queueMessageUpdate', {
                    queue: queue,
                    embedOnly: true,
                    message: this.message,
                    checkIfUpdated: true,
                    doNotSetUpdated: true,
                    callback: async () => {
                        this.canUpdate = true;
                    },
                });
            } catch (e) {
                if (e instanceof Error) this.client.emitEvent('error', e);
                return this.stop();
            }
        }, 5000);
    }

    public stop(): void {
        this.isAlive = false;
        try {
            clearInterval(this.timer);
        } catch (e) {}
    }

    private async getMessage(queue: Queue): Promise<Message | undefined> {
        const guild: Guild = await this.client.guilds.fetch(queue.guildId);
        const channel = await guild.channels.fetch(queue.channelId);
        if (!(channel instanceof TextChannel)) return;
        return channel.messages.fetch(queue.messageId).catch((e) => {
            this.client.emitEvent('error', e);
            return undefined;
        });
    }
}
