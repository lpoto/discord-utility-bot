import { AudioPlayer, VoiceConnection } from '@discordjs/voice';
import { Client, Message, TextChannel } from 'discord.js';
import {
    ClientEvent,
    ClientEventArgument,
    Event,
    LanguageKeyPath,
    LanguageString,
    MusicClientOptions,
} from '../';
import { Translator } from './translation';
import { PermissionChecker } from './utils';
import * as Events from './events';
import { Queue } from './entities';
import { Routes } from 'discord-api-types/v9';
import { REST } from '@discordjs/rest';

export class MusicClient extends Client {
    private clientToken: string;
    private translating: Translator;
    private permissionChecker: PermissionChecker;
    private voiceConnections: { [guildId: string]: VoiceConnection };
    private audioPlayers: { [guildId: string]: AudioPlayer };
    private clientReady: boolean;
    private shouldNotBeUpdated: { [guildId: string]: boolean };

    public constructor(options: MusicClientOptions) {
        super(options);
        this.clientReady = false;
        this.clientToken = options.token;
        this.voiceConnections = {};
        this.audioPlayers = {};
        this.translating = new Translator(options.defaultLanguage);
        this.shouldNotBeUpdated = {};
        this.permissionChecker = new PermissionChecker(
            options.clientVoicePermissions,
            options.clientTextPermissions,
            options.requiredMemberRoles,
            this,
        );
    }

    public get ready(): boolean {
        return (
            this.clientReady && this.user !== undefined && this.user !== null
        );
    }

    public set ready(value: boolean) {
        this.clientReady = value;
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

    public getAudioPlayer(guildId: string): AudioPlayer | null {
        return guildId in this.audioPlayers
            ? this.audioPlayers[guildId]
            : null;
    }

    public setAudioPlayer(guildId: string, player: AudioPlayer | null): void {
        if (!player) {
            if (guildId in this.audioPlayers)
                delete this.audioPlayers[guildId];
        } else this.audioPlayers[guildId] = player;
    }

    public translate(guildId: string | null, keys: LanguageKeyPath): string {
        return this.translator.translate(guildId, keys);
    }

    public updateGuildLanguage(lang: LanguageString, guildId: string): void {
        this.translator.setGuidLanguage(lang, guildId);
    }

    /** Register the slash command in all of the servers that the client is member of.*/
    public async registerSlashCommands(): Promise<void> {
        if (!this.user) return;
        console.log('Refreshing application (/) commands.');

        for await (const guild of this.guilds.cache) {
            try {
                await this.registerSlashCommand(guild[1].id);
                console.log(
                    `Successfully registered slash commands for guild "${guild[1].name}".`,
                );
            } catch (error) {
                console.error(
                    `Failed registering slash commands for guild "${guild[1].name}".`,
                );
            }
        }
    }

    /** Register a new music command that initializes the music in the server */
    public async registerSlashCommand(guildId: string): Promise<void> {
        const commands = [this.slashCommand(guildId)];
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
        return this.channels
            .fetch(queue.channelId)
            .then((channel) => {
                if (!channel || !(channel instanceof TextChannel)) return null;
                return channel.threads
                    .fetch(queue.threadId)
                    .then((thread) => {
                        return channel.messages
                            .fetch(queue.messageId)
                            .then((message) => {
                                if (!message && thread) {
                                    this.emitEvent(
                                        'musicThreadArchive',
                                        thread,
                                    );
                                    return null;
                                }
                                if (!thread && message) {
                                    message
                                        .delete()
                                        .catch((error) =>
                                            this.emitEvent('error', error),
                                        );
                                    return null;
                                }
                                if (update)
                                    this.emitEvent('queueMessageUpdate', {
                                        queue: queue,
                                        clientRestart: true,
                                    });
                                return message;
                            })
                            .catch((e) => {
                                this.emitEvent('error', e);
                                if (thread)
                                    this.emitEvent(
                                        'musicThreadArchive',
                                        thread,
                                    );
                                return null;
                            });
                    })
                    .catch((error) => {
                        this.emitEvent('error', error);
                        return null;
                    });
            })
            .catch((e) => {
                this.emitEvent('error', e);
                return null;
            });
    }

    private slashCommand(guildId: string): { [key: string]: string } {
        return {
            name: this.translate(null, ['slashCommand', 'name']),
            description: this.translate(guildId, [
                'slashCommand',
                'description',
            ]),
        };
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
