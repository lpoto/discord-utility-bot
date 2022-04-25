import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { Client } from 'discord.js';
import {
    ClientEvent,
    CustomClientOptions,
    Event,
    LanguageKeyPath,
} from '../../';
import { Logger } from '.';
import { Translator } from '../utils/translation';

export class CustomClient extends Client {
    private clientReady: boolean;
    private clientToken: string;
    private curVersion: string;
    private customLogger: Logger;
    private translating: Translator;
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
    }

    public get logger(): Logger {
        return this.customLogger;
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
        if (!this.user) return;
        this.logger.info('Refreshing application (/) commands.');

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
                        `Failed registering slash commands for guild: "${guildId}": `,
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
                            `Registered slash commands in ${this.slashCommandsInfo.registered} guilds, failed in ${this.slashCommandsInfo.failed}`,
                        );
                });
        })();
    }

    public translate(keys: LanguageKeyPath, args?: string[]): string {
        return this.translator.translate(keys, args);
    }

    public getEvents(): any[] {
        return [];
    }

    public emitEvent(...args: Event): void {
        this.emit(args[0] as string, args[1]);
    }

    public async run(): Promise<void> {
        this.logger.info(`Registering ${this.getEvents().length} events.`);
        for (const E of this.getEvents()) {
            const e: ClientEvent = new E(this);

            const callEvent = (
                n: string,
                f: (...args2: any[]) => Promise<void>,
            ) => (e.once ? this.once(n, f) : this.on(n, f));

            callEvent(E.eventName, async (...args) => {
                e.callback(...args);
            });
        }
        this.login(this.clientToken);
    }
}
