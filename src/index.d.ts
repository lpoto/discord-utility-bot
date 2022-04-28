import {
    ClientOptions,
    Interaction,
    Message,
    PartialMessage,
    PermissionResolvable,
    ThreadChannel,
} from 'discord.js';
import { english } from './utils/translation';
import { CustomClient, Logger } from './utils';
import { ClientEventQueue } from './utils/client-event-queue';

export type Language = typeof english;

type Path<T> = PathTree<T>[keyof PathTree<T>];
type PathTree<T> = {
    [P in keyof T]-?: T[P] extends object ? [P] | [P, ...Path<T[P]>] : [P];
};
export type LanguageKeyPath = Path<Language>;

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
