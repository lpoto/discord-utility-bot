import { Guild, Message, TextChannel } from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { CustomAudioPlayer } from './custom-audio-player';

export class SongTimer {
    private message: Message | undefined;
    private timer: NodeJS.Timer;
    private isAlive: boolean;
    private client: MusicClient;
    private maxTime: number;
    private curTime: number;
    private guildId: string;
    private canUpdate: boolean;

    public constructor(
        client: MusicClient,
        guildId: string,
        maxTime: number,
        message?: Message,
    ) {
        this.message = message;
        this.client = client;
        this.guildId = guildId;
        this.canUpdate = true;
        this.maxTime = maxTime;
        this.curTime = 0;
    }

    public start(): void {
        if (!this.guildId) return;
        this.isAlive = true;
        this.curTime = 0;
        const t = 5;
        this.timer = setInterval(async () => {
            try {
                this.curTime += t;
                if (
                    this.curTime >= this.maxTime + t ||
                    !this.isAlive ||
                    !this.client.user
                )
                    return this.stop();

                if (!this.canUpdate) return;

                const queue: Queue | undefined = await Queue.findOne({
                    guildId: this.guildId,
                    clientId: this.client.user.id,
                });

                if (!queue) return this.stop();
                if (!this.message || this.message.id !== queue.messageId)
                    this.message = await this.getMessage(queue);
                if (!this.message) return;
                if (!this.guildId) return this.stop();
                const audioPlayer: CustomAudioPlayer | null =
                    this.client.getAudioPlayer(this.guildId);

                if (!audioPlayer) return this.stop();
                if (!audioPlayer.playing || queue.hasDropdownOption()) return;

                this.canUpdate = false;

                this.client.emitEvent('queueMessageUpdate', {
                    queue: queue,
                    message: this.message,
                    checkIfUpdated: true,
                    doNotSetUpdated: true,
                    embedOnly: true,
                    timeout: 500,
                    onUpdate: async () => {
                        setTimeout(() => {
                            this.canUpdate = true;
                        }, (t - 1.5) * 1000);
                    },
                    onError: async () => {
                        setTimeout(() => {
                            this.canUpdate = true;
                        }, (t - 1.5) * 1000);
                    },
                });
            } catch (e) {
                if (e instanceof Error) this.client.emitEvent('error', e);
                return this.stop();
            }
        }, t * 1000);
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
