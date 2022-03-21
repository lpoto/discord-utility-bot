import { Queue } from './entities';
import {
    ClientOptions,
    Interaction,
    Message,
    MessageButton,
    MessageSelectMenu,
    PartialMessage,
    PermissionResolvable,
    SelectMenuInteraction,
    ThreadChannel,
    VoiceState,
} from 'discord.js';
import { Languages } from './translation';
import { ButtonInteraction, CommandInteraction } from 'discord.js';
import { MusicClient } from './client';
import * as Commands from './commands';
import { ClientEventQueue } from './utils/client-event-queue';
import * as Events from './events';

export interface UpdateQueueOptions {
    queue: Queue;
    interaction?:
        | ButtonInteraction
        | CommandInteraction
        | SelectMenuInteraction;
    message?: Message;
    clientRestart?: boolean;
    innactivity?: boolean;
    timeout?: number;
    checkIfUpdated?: boolean;
    doNotSetUpdated?: boolean;
    onUpdate?: () => Promise<void>;
    onError?: () => Promise<void>;
}

export interface QueueEmbedOptions extends UpdateQueueOptions {
    client: MusicClient;
}

export interface MusicClientOptions extends ClientOptions {
    token: string;
    defaultLanguage: LanguageString;
    requiredMemberRoles: string[];
    clientVoicePermissions: PermissionResolvable[];
    clientTextPermissions: PermissionResolvable[];
}

export type CommandName = keyof typeof Commands;

export class Command {
    private commandId: string;
    protected client: MusicClient;
    protected guildId: string;
    public constructor(client: MusicClient, guildId: string);
    public get description(): string | null;
    public button(queue: Queue): MessageButton | null;
    public button2(queue: Queue): MessageButton | null;
    public selectMenu(queue: Queue): MessageSelectMenu | null;
    public execute(interaction?: ButtonInteraction): Promise<void>;
    public executeFromSelectMenu(
        interaction: SelectMenuInteraction,
    ): Promise<void>;
}

export type LanguageString = keyof typeof Languages;
export type Language = typeof Languages[LanguageString];

type Path<T> = PathTree<T>[keyof PathTree<T>];
type PathTree<T> = {
    [P in keyof T]-?: T[P] extends object ? [P] | [P, ...Path<T[P]>] : [P];
};
export type LanguageKeyPath = Path<Language>;

export interface EventHandlerQueueOptions {
    name: string;
    id: string;
    callback?: () => Promise<void>;
}

export type ClientEventArgument =
    | string
    | Interaction
    | Message
    | Error
    | PartialMessage
    | ThreadChannel
    | UpdateQueueOptions
    | DestroyMusicOptions
    | NewSongOptions
    | ExecuteCommandOptions
    | VoiceState;

export class ClientEvent {
    public once?: boolean;
    public client: MusicClient;
    public eventQueue: ClientEventQueue;
    public constructor(client: MusicClient);
    public callback(...args: ClientEventArgument[]): Promise<void>;
    public static get eventName(): string;
}

export type Event =
    | Events.OnReady.Type
    | Events.OnError.Type
    | Events.OnNewSong.Type
    | Events.OnMenuSelect.Type
    | Events.OnButtonClick.Type
    | Events.OnMusicDestroy.Type
    | Events.OnThreadDelete.Type
    | Events.OnMessageDelete.Type
    | Events.OnMessageCreate.Type
    | Events.OnExecuteCommand.Type
    | Events.OnJoinVoiceRequest.Type
    | Events.OnInteractionCreate.Type
    | Events.OnVoiceStateUpdate.Type
    | Events.OnQueueMessageUpdate.Type
    | Events.OnMusicThreadArchive.Type
    | Events.OnSlashCommand.Type;

export interface DestroyMusicOptions {
    guildId: string;
    threadId?: string;
}

export interface NewSongOptions {
    guildId: string;
    songNames: string[];
}

export interface ExecuteCommandOptions {
    interaction?: ButtonInteraction | SelectMenuInteraction;
    name?: string;
    guildId?: string;
}
