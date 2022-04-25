import { VoiceConnection } from '@discordjs/voice';
import {
    AnyChannel,
    Client,
    Message,
    TextChannel,
    ThreadChannel,
} from 'discord.js';
import {
    ClientEvent,
    ClientEventArgument,
    Event,
    MusicClientOptions,
} from './music-bot';
import {
    ActiveCommandsOptions,
    CustomAudioPlayer,
    PermissionChecker,
} from './utils';
import * as Events from './events';
import { Queue } from './entities';
import { Routes } from 'discord-api-types/v9';
import { REST } from '@discordjs/rest';
import { LanguageKeyPath } from './common';
import { Translator } from '../common/translation';
import { Logger } from '../common/utils';

export class MusicClient extends Client {
    private clientToken: string;
    private curVersion: string;
    private musicLogger: Logger;
    private translating: Translator;
    private permissionChecker: PermissionChecker;
    private voiceConnections: { [guildId: string]: VoiceConnection };
    private audioPlayers: { [guildId: string]: CustomAudioPlayer };
    private clientReady: boolean;
    private shouldNotBeUpdated: { [guildId: string]: boolean };
    private activeOptions: ActiveCommandsOptions;

    public constructor(options: MusicClientOptions) {
        super(options);
        this.clientReady = false;
        this.curVersion = options.version;
        this.musicLogger = options.logger;
        this.clientToken = options.token;
        this.voiceConnections = {};
        this.audioPlayers = {};
        this.translating = new Translator();
        this.shouldNotBeUpdated = {};
        this.activeOptions = new ActiveCommandsOptions(this);
        this.permissionChecker = new PermissionChecker(
            options.clientVoicePermissions,
            options.clientTextPermissions,
            options.requiredMemberRoles,
            this,
        );
    }

    public get logger(): Logger {
        return this.musicLogger;
    }

    public get ready(): boolean {
        return (
            this.clientReady && this.user !== undefined && this.user !== null
        );
    }

    public set ready(value: boolean) {
        this.clientReady = value;
    }

    public get version(): string {
        return this.curVersion;
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

    public emitEvent(...args: Event): void {
        this.emit(args[0] as string, args[1]);
    }

    public get permsChecker(): PermissionChecker {
        return this.permissionChecker;
    }

    public get translator(): Translator {
        return this.translating;
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

    public translate(keys: LanguageKeyPath, args?: string[]): string {
        return this.translator.translate(keys, args);
    }

    /** Register the slash command in all of the servers that the client is member of.*/
    public async registerSlashCommands(): Promise<void> {
        if (!this.user) return;
        this.logger.info('Refreshing application (/) commands.');

        for await (const guild of this.guilds.cache) {
            try {
                await this.registerSlashCommand(guild[1].id);
                this.logger.debug(
                    `Successfully registered slash commands for "${guild[1].name}".`,
                );
            } catch (error) {
                this.logger.debug(
                    `Failed registering slash commands for "${guild[1].name}".`,
                );
            }
        }
    }

    public async registerSlashCommand(guildId: string): Promise<void> {
        const commands = this.translator.getFullLanguage().music.slashCommands;
        const rest = new REST({ version: '9' }).setToken(this.clientToken);
        (async () => {
            if (!this.user) return;
            await rest.put(
                Routes.applicationGuildCommands(this.user.id, guildId),
                { body: commands },
            );
        })();
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

    /** Subscribe to required client events for the music client and login */
    public async run(): Promise<void> {
        for (const E of Object.values(Events)) {
            const e: ClientEvent = new E(this);
            if (e.once) {
            }

            const callEvent = (
                n: string,
                f: (...args2: ClientEventArgument[]) => Promise<void>,
            ) => (e.once ? this.once(n, f) : this.on(n, f));

            callEvent(E.eventName, async (...args) => {
                e.callback(...args);
            });
        }
        this.login(this.clientToken);
    }
}
