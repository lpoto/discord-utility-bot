import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import {
    ClientEvent,
    CustomClientOptions,
    Event,
    LanguageKeyPath,
    NotifyOptions,
    StartClientOptions,
} from '../../';
import { Logger } from '.';
import { Translator } from '../utils/translation';
import { PermissionChecker } from './permission-checker';
import {
    BitFieldResolvable,
    Client,
    Intents,
    IntentsString,
    MessageEmbed,
    PermissionResolvable,
    Permissions,
    TextChannel,
} from 'discord.js';
import { RolesChecker } from './roles-checker';

export abstract class CustomClient extends Client {
    private clientReady: boolean;
    private clientToken: string;
    private curVersion: string;
    private customLogger: Logger;
    private translating: Translator;
    private permissionChecker: PermissionChecker;
    private checkingRoles: RolesChecker;
    private slashCommandsInfo: {
        [key in 'registered' | 'toRegister' | 'failed']: number;
    };

    public constructor(options: CustomClientOptions) {
        super(options);
        this.clientReady = false;
        this.clientToken = options.token;
        this.curVersion = options.version;
        this.customLogger = options.logger;
        this.translating = new Translator();
        this.slashCommandsInfo = {
            failed: 0,
            registered: 0,
            toRegister: this.guilds.cache.size,
        };
        this.permissionChecker = new PermissionChecker(
            options.clientVoicePermissions,
            options.clientTextPermissions,
            this,
        );
        this.checkingRoles = new RolesChecker(
            this,
            options.requiredMemberRoles,
        );
    }

    public get logger(): Logger {
        return this.customLogger;
    }

    public get permsChecker(): PermissionChecker {
        return this.permissionChecker;
    }

    public get rolesChecker(): RolesChecker {
        return this.checkingRoles;
    }

    public get translator(): Translator {
        return this.translating;
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

    public async registerSlashCommands(commands: any[]): Promise<void> {
        if (process.env.REGISTER_SLASH_COMMANDS?.toLowerCase() !== 'true') {
            this.logger.debug(
                'Not Refreshing application (/) commands',
                '(env REGISTER_SLASH_COMMANDS is not set to true).',
            );
            return;
        }
        if (!this.user || commands.length === 0) return;
        this.logger.info(
            `Refreshing ${commands.length} application (/) command/s.`,
        );

        this.slashCommandsInfo.toRegister = this.guilds.cache.size;
        for await (const guild of this.guilds.cache) {
            await this.registerSlashCommand(guild[1].id, commands).catch(
                (e) => {
                    this.logger.warn(e);
                },
            );
        }
    }

    public async registerSlashCommand(
        guildId: string,
        commands: any,
    ): Promise<void> {
        const rest = new REST({ version: '9' }).setToken(this.clientToken);
        await (async () => {
            if (!this.user) return;
            await rest
                .put(Routes.applicationGuildCommands(this.user.id, guildId), {
                    body: commands,
                })
                .then(() => {
                    this.logger.debug(
                        `Registered slash commands for guild: "${guildId}"`,
                    );
                    this.slashCommandsInfo.registered += 1;
                })
                .catch((e) => {
                    this.logger.debug(
                        'Failed registering slash commands for guild: ' +
                            guildId +
                            ': ',
                        e.message,
                    );
                    this.slashCommandsInfo.failed += 1;
                })
                .finally(() => {
                    if (
                        this.slashCommandsInfo.registered +
                            this.slashCommandsInfo.failed ===
                        this.slashCommandsInfo.toRegister
                    )
                        this.logger.info(
                            'Registered slash commands in',
                            this.slashCommandsInfo.registered.toString(),
                            'guild/s, failed in ',
                            this.slashCommandsInfo.failed.toString(),
                        );
                });
        })();
    }

    public async notify(options: NotifyOptions): Promise<void> {
        if (
            (!options.interaction && !options.channelId) ||
            options.content.length === 0
        )
            return;
        const embed: MessageEmbed = new MessageEmbed()
            .setDescription(options.content)
            .setColor(options.warn ? 'RED' : 'GREEN');
        if (options.interaction)
            return await options.interaction
                .reply({
                    embeds: [embed],
                    ephemeral: options.ephemeral,
                })
                .catch((e: Error) => {
                    this.emitEvent('error', e);
                });
        if (!options.channelId) return;
        const channel: TextChannel | undefined = await this.channels
            .fetch(options.channelId)
            .then((c) => {
                if (!(c instanceof TextChannel)) return undefined;
                return c;
            })
            .catch((e: Error) => {
                this.emitEvent('error', e);
                return undefined;
            });
        await channel
            ?.send({
                embeds: [embed],
            })
            .catch((e: Error) => {
                this.emitEvent('error', e);
            });
    }

    public translate(keys: LanguageKeyPath, ...args: string[]): string {
        return this.translator.translate(keys, args);
    }

    public getEvents(): any[] {
        return [];
    }

    public emitEvent(...args: Event): void {
        if (this.getEvents().length > 0)
            this.logger.warn('emitEvent method should be overriden!');
        this.emit(args[0] as string, args[1]);
    }

    public async run(): Promise<void> {
        this.logger.info(`Registering ${this.getEvents().length} events.`);
        for (const E of this.getEvents()) {
            const e: ClientEvent = new E(this);

            if (e.once)
                this.once(E.eventName, async (...args) => {
                    e.callback(...args);
                });
            else {
                this.on(E.eventName, async (...args) => {
                    if (!this.ready && e.needsClientReady) return;
                    e.callback(...args);
                });
            }
        }
        this.login(this.clientToken);
    }

    protected static getClientTextPermissions(): PermissionResolvable[] {
        return [
            Permissions.FLAGS.SEND_MESSAGES,
            Permissions.FLAGS.READ_MESSAGE_HISTORY,
            Permissions.FLAGS.CREATE_PUBLIC_THREADS,
        ];
    }

    protected static getClientVoicePermissions(): PermissionResolvable[] {
        return [
            Permissions.FLAGS.SPEAK,
            Permissions.FLAGS.CONNECT,
            Permissions.FLAGS.USE_VAD,
        ];
    }

    protected static getRequiredMemberRoles(): string[] {
        return [];
    }

    protected static getRequiredIntents(): BitFieldResolvable<
        IntentsString,
        number
    > {
        return [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.GUILD_INTEGRATIONS,
        ];
    }

    public static async start(
        options: StartClientOptions,
    ): Promise<[Logger.Level, string]> {
        const NewClient: any = this;
        const clientName: string = this.name;
        if (!options.token)
            return [Logger.Level.INFO, `No token provided for ${clientName}`];
        if (!options.connection.isConnected)
            return [
                Logger.Level.ERROR,
                `No valid database connection when starting ${clientName}`,
            ];
        let result: [Logger.Level, string] = [
            Logger.Level.WARN,
            'Something went wrong',
        ];
        await (
            new NewClient({
                token: options.token,
                version: options.version,
                logger: new Logger(clientName, options.logLevel),
                clientTextPermissions: this.getClientTextPermissions(),
                clientVoicePermissions: this.getClientVoicePermissions(),
                requiredMemberRoles: this.getRequiredMemberRoles(),
                intents: this.getRequiredIntents(),
            } as CustomClientOptions) as CustomClient
        )
            .run()
            .then(() => {
                result = [
                    Logger.Level.INFO,
                    `Started ${clientName} ${options.version}`,
                ];
            })
            .catch((e: Error) => {
                result[0] = Logger.Level.ERROR;
                result[1] = e.message;
            });
        return result;
    }
}
