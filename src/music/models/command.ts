import { randomUUID } from 'crypto';
import { ButtonInteraction, MessageButton, ThreadChannel } from 'discord.js';
import { MusicClient } from '../../client';
import { LanguageKeyPath } from '../../translation';
import { MusicCommandOptions } from '../commands';
import { SongQueue } from '../models';
import { Music } from '../music';

export abstract class Command {
    private options: MusicCommandOptions;
    private commandId: string;

    constructor(options: MusicCommandOptions) {
        this.options = options;
        this.commandId = this.name + randomUUID();
    }

    get id(): string {
        return this.commandId;
    }

    get name(): string {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (<any>this).constructor.name;
    }

    get music(): Music {
        return this.options.music;
    }

    get client(): MusicClient {
        return this.options.music.client;
    }

    get thread(): ThreadChannel | null {
        return this.options.music.thread;
    }

    get queue(): SongQueue | null {
        return this.options.music.queue;
    }

    get guildId(): string {
        return this.options.music.guildId;
    }

    get button(): MessageButton | null {
        return null;
    }

    get description(): string | null {
        return null;
    }

    public translate(keys: LanguageKeyPath) {
        return this.options.music.translate(keys);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        console.log(interaction);
    }
}
