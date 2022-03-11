import { REST } from '@discordjs/rest';
import { AudioPlayer, VoiceConnection } from '@discordjs/voice';
import { Routes } from 'discord-api-types/v9';
import { Client } from 'discord.js';
import { LanguageKeyPath, LanguageString, MusicClientOptions } from '../../';
import { QueueOption } from '../entities';
import { MusicActions } from '../music-actions';
import { Translator } from '../translation';
import { ClientEventHandler } from './client-event-handler';
import { PermissionChecker } from './permission-checker';

export class MusicClient extends Client {
    private translator: Translator;
    private permissionChecker: PermissionChecker;
    private eventsHandler: ClientEventHandler;
    private voiceConnections: { [guildId: string]: VoiceConnection };
    private audioPlayers: { [guildId: string]: AudioPlayer };
    private musicactions: MusicActions;
    private clientReady: boolean;

    public constructor(options: MusicClientOptions) {
        super(options);
        this.voiceConnections = {};
        this.audioPlayers = {};
        this.translator = new Translator(options.defaultLanguage);
        this.eventsHandler = new ClientEventHandler(this);
        this.musicactions = new MusicActions(this);
        this.clientReady = false;
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

    public get permsChecker(): PermissionChecker {
        return this.permissionChecker;
    }

    public get musicActions(): MusicActions {
        return this.musicactions;
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

    public handleError(error: Error, location?: string): void {
        return this.eventsHandler.handleError(error, location);
    }

    public slashCommand(guildId: string): { [key: string]: string } {
        return {
            name: this.translate(null, ['slashCommand', 'name']),
            description: this.translate(guildId, [
                'slashCommand',
                'description',
            ]),
        };
    }

    public async setup(token: string): Promise<void> {
        if (!this.user) return;

        console.log('------------------------------------');
        console.log(`  Logged in as user ${this.user.tag}`);
        console.log('------------------------------------');

        await this.translator.setup();
        await QueueOption.seed();
        await this.registerSlashCommands(token);
        this.user.setActivity(
            '/' + this.translate(null, ['slashCommand', 'name']),
            {
                type: 'PLAYING',
            },
        );
        this.clientReady = true;
        console.log('------------------------------------');
        console.log('  Client ready!');
        console.log('------------------------------------');
    }

    /** Register the slash command in all of the servers that the client is member of.*/
    public async registerSlashCommands(token: string): Promise<void> {
        if (!this.user) return;
        console.log('Refreshing application (/) commands.');

        for await (const guild of this.guilds.cache) {
            try {
                await this.registerSlashCommand(guild[1].id, token);
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
    public async registerSlashCommand(
        guildId: string,
        token: string,
    ): Promise<void> {
        const commands = [this.slashCommand(guildId)];
        const rest = new REST({ version: '9' }).setToken(token);
        (async () => {
            if (!this.user) return;
            await rest.put(
                Routes.applicationGuildCommands(this.user.id, guildId),
                { body: commands },
            );
        })();
    }

    public async destroyMusic(guildId: string): Promise<void> {
        return this.eventsHandler.destroyMusic(guildId);
    }

    /** Subscribe to required client events for the music client and login */
    public static async run(
        client: MusicClient,
        token: string,
    ): Promise<void> {
        await client.eventsHandler.subscribe(token);
        client.login(token);
    }
}
