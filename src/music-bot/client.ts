import { VoiceConnection } from '@discordjs/voice';
import {
    AnyChannel,
    BitFieldResolvable,
    Intents,
    IntentsString,
    Message,
    TextChannel,
    ThreadChannel,
} from 'discord.js';
import { MusicClientOptions, Event } from './music-bot';
import { ActiveCommandsOptions, CustomAudioPlayer } from './utils';
import * as Events from './events';
import { Queue } from './entities';
import { CustomClient } from '../utils';
import { musicBotEn } from './utils/translation';

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

    public get text(): typeof musicBotEn {
        return musicBotEn;
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

    public destroyVoiceConnection(guildId: string | null | undefined): void {
        if (!guildId || !(guildId in this.voiceConnections)) return;
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
        const channel: AnyChannel | null | undefined = await this.channels
            .fetch(queue.channelId)
            .catch((e) => {
                this.emitEvent('error', e);
                return undefined;
            });
        if (!channel || !(channel instanceof TextChannel)) return null;
        const thread: ThreadChannel | null | undefined = await channel.threads
            .fetch(queue.threadId)
            .catch((e) => {
                this.emitEvent('error', e);
                return undefined;
            });
        const message: Message | null | undefined = await channel.messages
            .fetch(queue.messageId)
            .catch((e) => {
                this.emitEvent('error', e);
                return undefined;
            });
        if (!message) {
            if (thread)
                thread.delete().catch((e) => this.emitEvent('error', e));
            return null;
        }
        if (!thread || update)
            this.emitEvent('queueMessageUpdate', {
                queue: queue,
                openThreadOnly: !update && !thread,
                openThread: !thread,
                message: message,
                clientRestart: true,
            });
        return message;
    }

    public async checkThreads(): Promise<void> {
        if (!this.user) return;
        this.logger.debug('Checking for orphaned threads');
        let i = 0;
        for (const c of this.channels.cache) {
            const channel: AnyChannel = c[1];
            if (
                !(channel instanceof ThreadChannel) ||
                channel.ownerId !== this.user.id
            )
                continue;
            const queue: Queue | undefined = await Queue.findOne({
                guildId: channel.guildId,
                clientId: this.user.id,
                threadId: channel.id,
            }).catch((e) => {
                this.emitEvent('error', e);
                return undefined;
            });
            if (queue) continue;
            i++;
            await channel
                .delete()
                .then()
                .catch((e) => {
                    this.emitEvent('error', e);
                    i--;
                });
        }
        this.logger.debug(`Deleted ${i} orphaned thread/s`);
    }

    public getEvents(): any[] {
        return Object.values(Events);
    }

    public emitEvent(...args: Event): void {
        super.emit(args[0] as string, args[1]);
    }

    protected static getRequiredMemberRoles(): string[] {
        return ['DJ'];
    }

    protected static getRequiredIntents(): BitFieldResolvable<
        IntentsString,
        number
    > {
        return [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.GUILD_MEMBERS,
            Intents.FLAGS.GUILD_VOICE_STATES,
        ];
    }
}
