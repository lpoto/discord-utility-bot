import {
    ButtonInteraction,
    ClientOptions,
    CommandInteraction,
    Interaction,
    Message,
    PartialMessage,
    PermissionResolvable,
    SelectMenuInteraction,
    ThreadChannel,
} from 'discord.js';
import { CustomClient, Logger } from './utils';
import { ClientEventQueue } from './utils/client-event-queue';
import { Connection } from 'typeorm';

export { Language, LanguageKeyPath } from './translation';

export interface StartClientOptions {
    connection: Connection;
    token: string;
    version: string;
    botName: string;
    logLevel?: Logger.Level;
    id?: string;
}

export interface CustomClientOptions extends ClientOptions {
    logger: Logger;
    token: string;
    version: string;
    clientTextPermissions: PermissionResolvable[];
    clientVoicePermissions: PermissionResolvable[];
    requiredMemberRoles: string[];
}

export type ClientEventArgument =
    | string
    | Interaction
    | Message
    | Error
    | PartialMessage
    | ThreadChannel;

export class ClientEvent {
    public once?: boolean;
    public needsClientReady: boolean;
    public client: CustomClient;
    public eventQueue: ClientEventQueue;
    public constructor(client: CustomClient);
    public callback(...args: ClientEventArgument[]): Promise<void>;
    public static get eventName(): string;
}

export type Event = any;

export interface EventHandlerQueueOptions {
    name: string;
    id: string;
    callback?: () => Promise<void>;
}

export interface NotifyOptions {
    warn?: boolean;
    content: string;
    interaction?:
        | ButtonInteraction
        | CommandInteraction
        | SelectMenuInteraction;
    channelId?: string;
    ephemeral?: boolean;
}
