import { AudioPlayer, VoiceConnection } from '@discordjs/voice';
import { Client } from 'discord.js';
import {
    ClientEvent,
    ClientEventArgument,
    LanguageKeyPath,
    LanguageString,
    MusicClientOptions,
} from '../';
import { MusicActions } from './music-actions';
import { Translator } from './translation';
import { PermissionChecker } from './utils';
import { UtilityActions } from './utility-actions';
import * as Events from './events';

export class MusicClient extends Client {
    private clientToken: string;
    private translating: Translator;
    private permissionChecker: PermissionChecker;
    private voiceConnections: { [guildId: string]: VoiceConnection };
    private audioPlayers: { [guildId: string]: AudioPlayer };
    private musicactions: MusicActions;
    private utilityactions: UtilityActions;
    private clientReady: boolean;

    public constructor(options: MusicClientOptions) {
        super(options);
        this.clientReady = false;
        this.clientToken = options.token;
        this.voiceConnections = {};
        this.audioPlayers = {};
        this.musicactions = new MusicActions(this);
        this.utilityactions = new UtilityActions(this, this.clientToken);
        this.translating = new Translator(options.defaultLanguage);
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

    public get permsChecker(): PermissionChecker {
        return this.permissionChecker;
    }

    public get translator(): Translator {
        return this.translating;
    }

    public get musicActions(): MusicActions {
        return this.musicactions;
    }

    public get utilityActions(): UtilityActions {
        return this.utilityactions;
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

    public slashCommand(guildId: string): { [key: string]: string } {
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
        for (const Event of Object.values(Events)) {
            const e: ClientEvent = new Event(this);
            if (e.once) {
            }

            const callEvent = (
                n: string,
                f: (...args2: ClientEventArgument[]) => Promise<void>,
            ) => (e.once ? this.once(n, f) : this.on(n, f));

            callEvent(e.name, async (...args) => {
                e.callback(...args);
            });
        }

        this.login(this.clientToken);
    }
}
