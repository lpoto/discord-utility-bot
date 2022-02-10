import { randomUUID } from 'crypto';
import { ButtonInteraction, MessageButton, ThreadChannel } from 'discord.js';
import { MusicCommandOptions } from '.';
import { MusicClient } from '../../client';
import { LanguageKeyPath } from '../../translation';
import { Music } from '../music';
import { SongQueue } from '../song-queue';

export abstract class Command {
    private options: MusicCommandOptions;
    private commandId: string;

    constructor(options: MusicCommandOptions) {
        this.options = options;
        this.commandId = randomUUID();
    }

    get id(): string {
        return this.commandId;
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

    public translate(keys: LanguageKeyPath) {
        return this.options.music.translate(keys);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {}
}
