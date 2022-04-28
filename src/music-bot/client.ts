import { VoiceConnection } from '@discordjs/voice';
import { AnyChannel, Message, TextChannel, ThreadChannel } from 'discord.js';
import { MusicClientOptions, Event } from './music-bot';
import { ActiveCommandsOptions, CustomAudioPlayer } from './utils';
import * as Events from './events';
import { Queue } from './entities';
import { CustomClient } from '../utils';

export class MusicClient extends CustomClient {
    private voiceConnections: { [guildId: string]: VoiceConnection };
    private audioPlayers: { [guildId: string]: CustomAudioPlayer };
    private shouldNotBeUpdated: { [guildId: string]: boolean };
    private activeOptions: ActiveCommandsOptions;

    public constructor(options: MusicClientOptions) {
        super(options);
        this.voiceConnections = {};
        this.audioPlayers = {};
        this.shouldNotBeUpdated = {};
        this.activeOptions = new ActiveCommandsOptions(this);
    }

    public get activeCommandsOptions(): ActiveCommandsOptions {
        return this.activeOptions;
    }

    public alreadyUpdated(guildId: string): boolean {
        return guildId in this.shouldNotBeUpdated
            ? this.shouldNotBeUpdated[guildId]
            : false;
    }

    public setAlreadyUpdated(guildId: string, value: boolean): void {
        if (!value) {
            if (guildId in this.shouldNotBeUpdated)
                delete this.shouldNotBeUpdated[guildId];
            return;
        }
        this.shouldNotBeUpdated[guildId] = value;
    }

    public getVoiceConnection(guildId: string): VoiceConnection | null {
        return guildId in this.voiceConnections
            ? this.voiceConnections[guildId]
            : null;
    }

    public setVoiceConnection(
        guildId: string,
        connection: VoiceConnection,
    ): void {
        this.voiceConnections[guildId] = connection;
    }

    public destroyVoiceConnection(guildId: string): void {
        if (!(guildId in this.voiceConnections)) return;
        this.voiceConnections[guildId].destroy();
        delete this.voiceConnections[guildId];
    }

    public getAudioPlayer(guildId: string): CustomAudioPlayer | null {
        return guildId in this.audioPlayers
            ? this.audioPlayers[guildId]
            : null;
    }

    public setAudioPlayer(
        guildId: string,
        player: CustomAudioPlayer | null,
    ): void {
        if (!player) {
            if (guildId in this.audioPlayers) {
                this.audioPlayers[guildId].kill();
                delete this.audioPlayers[guildId];
            }
        } else this.audioPlayers[guildId] = player;
    }

    public async checkThreadAndMessage(
        queue: Queue,
        update?: boolean,
    ): Promise<Message | null> {
        const channel: AnyChannel | null = await this.channels.fetch(
            queue.channelId,
        );
        if (!channel || !(channel instanceof TextChannel)) return null;
        const thread: ThreadChannel | null = await channel.threads.fetch(
            queue.threadId,
        );
        const message: Message | null = await channel.messages.fetch(
            queue.messageId,
        );
        if (!thread) {
            if (message)
                message.delete().catch((e) => {
                    this.emitEvent('error', e);
                });
            return null;
        }
        if (!message) {
            if (thread) this.emitEvent('musicThreadArchive', thread);
            return null;
        }
        if (update)
            this.emitEvent('queueMessageUpdate', {
                queue: queue,
                clientRestart: true,
            });
        return message;
    }

    public getEvents(): any[] {
        return Object.values(Events);
    }

    public emitEvent(...args: Event): void {
        super.emit(args[0] as string, args[1]);
    }
}
