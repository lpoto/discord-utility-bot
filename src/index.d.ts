import { Queue } from './entities/queue';
import {
    ClientOptions,
    MessageButton,
    PermissionResolvable,
} from 'discord.js';
import { Languages } from './translation';
import { ButtonInteraction, CommandInteraction } from 'discord.js';
import { MusicClient } from './client';
import * as Commands from './commands';

export interface UpdateQueueOptions {
    queue: Queue;
    reload?: boolean;
    embedOnly?: boolean;
    componentsOnly?: boolean;
    interaction?: ButtonInteraction | CommandInteraction;
    clientRestart?: boolean;
    innactivity?: boolean;
}

export interface QueueEmbedOptions extends UpdateQueueOptions {
    client: MusicClient;
}

export interface MusicClientOptions extends ClientOptions {
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

    constructor(client: MusicClient, guildId: string);

    get description(): string | null;

    public button(queue: Queue): MessageButton | null;
    public button2(queue: Queue): MessageButton | null;

    public execute(interaction?: ButtonInteraction): Promise<void>;
}

export type LanguageString = keyof typeof Languages;
export type Language = typeof Languages[LanguageString];

type Path<T> = PathTree<T>[keyof PathTree<T>];
type PathTree<T> = {
    [P in keyof T]-?: T[P] extends object ? [P] | [P, ...Path<T[P]>] : [P];
};
export type LanguageKeyPath = Path<Language>;
