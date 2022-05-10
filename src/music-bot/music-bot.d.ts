import { Queue } from '../music-bot/entities';
import {
    GuildMember,
    Message,
    MessageButton,
    MessageSelectMenu,
    PartialMessage,
    SelectMenuInteraction,
    VoiceState,
} from 'discord.js';
import { ButtonInteraction, CommandInteraction } from 'discord.js';
import { MusicClient } from './client';
import * as Commands from './commands';
import * as Events from './events';
import { ClientEventArgument, CustomClientOptions } from '../../';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export interface UpdateQueueOptions {
    queue: Queue;
    interaction?:
        | ButtonInteraction
        | CommandInteraction
        | SelectMenuInteraction;
    message?: Message | PartialMessage;
    openThreadOnly?: boolean;
    openThread?: boolean;
    clientRestart?: boolean;
    innactivity?: boolean;
    timeout?: number;
    checkIfUpdated?: boolean;
    doNotSetUpdated?: boolean;
    onUpdate?: () => Promise<void>;
    onError?: () => Promise<void>;
    resend?: boolean;
    embedOnly?: boolean;
}

export class MusicClientEvent extends AbstractClientEvent {
    public client: MusicClient;
    public callback(...args: MusicClientEventArgument[]): Promise<void>;
}

export interface QueueEmbedOptions extends UpdateQueueOptions {
    client: MusicClient;
}

export type MusicClientOptions = CustomClientOptions;

export type CommandName = keyof typeof Commands;

export class Command {
    private commandId: string;
    protected client: MusicClient;
    protected guildId: string;
    public constructor(client: MusicClient, guildId: string);
    public get reggex(): RegExp | null;
    public get description(): string | null;
    public get checkRolesFor(): string | null;
    public get additionalHelp(): string | null;
    public get name(): string;
    public get interactionTimeout(): number;
    public get alwaysExecute(): boolean;
    public get needsDefer(): boolean;
    public get joinVoice(): boolean;
    public get checkMemberPerms(): boolean;
    public button(queue: Queue): MessageButton | null;
    public button2(queue: Queue): MessageButton | null;
    public selectMenu(queue: Queue): MessageSelectMenu | null;
    public execute(
        interaction?:
            | ButtonInteraction
            | CommandInteraction
            | SelectMenuInteraction,
    ): Promise<void>;
    public updateQueue(options: UpdateQueueOptions): void;
    public executeFromSelectMenu(
        interaction: SelectMenuInteraction,
    ): Promise<void>;
    public executeFromReggex(message: Message): Promise<void>;
}

export type MusicClientEventArgument =
    | ClientEventArgument
    | UpdateQueueOptions
    | DestroyMusicOptions
    | NewSongOptions
    | ExecuteCommandOptions
    | VoiceState;

export type Event =
    | Events.OnReady.Type
    | Events.OnError.Type
    | Events.OnNewSong.Type
    | Events.OnMenuSelect.Type
    | Events.OnButtonClick.Type
    | Events.OnThreadDelete.Type
    | Events.OnMessageDelete.Type
    | Events.OnConfigSlashCommand.Type
    | Events.OnMessageCreate.Type
    | Events.OnExecuteCommand.Type
    | Events.OnJoinVoiceRequest.Type
    | Events.OnInteractionCreate.Type
    | Events.OnVoiceStateUpdate.Type
    | Events.OnQueueMessageUpdate.Type
    | Events.OnSlashCommand.Type;

export interface DestroyMusicOptions {
    guildId: string;
    threadId?: string;
}

export interface NewSongOptions {
    guildId: string;
    songNames: string[];
    toFront?: boolean;
}

export interface ExecuteCommandOptions {
    member?: GuildMember;
    guildId?: string;
    interaction?:
        | ButtonInteraction
        | SelectMenuInteraction
        | CommandInteraction;
    name?: CommandName;
    message?: Message;
}

export type CustomAudioPlayerTrigger =
    | 'skip'
    | 'replay'
    | 'previous'
    | 'jumpForward'
    | 'jumpBackward';
