import { AudioPlayer, VoiceConnection } from '@discordjs/voice';
import { randomUUID } from 'crypto';
import { ButtonInteraction, MessageButton } from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { LanguageKeyPath } from '../translation';

export abstract class AbstractCommand {
    private commandId: string;
    protected client: MusicClient;
    protected guildId: string;

    constructor(client: MusicClient, guildId: string) {
        this.client = client;
        this.guildId = guildId;
        this.commandId = this.name + randomUUID();
    }

    get id(): string {
        return this.commandId;
    }

    get name(): string {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (<any>this).constructor.name;
    }

    get audioPlayer(): AudioPlayer | null {
        return this.client.getAudioPlayer(this.guildId);
    }

    get connection(): VoiceConnection | null {
        return this.client.getVoiceConnection(this.guildId);
    }

    get description(): string | null {
        return null;
    }
    public async getQueue(): Promise<Queue | undefined> {
        if (!this.client.user) return undefined;
        return await Queue.findOne({
            clientId: this.client.user.id,
            guildId: this.guildId,
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public button(queue: Queue): MessageButton | null {
        return null;
    }

    public button2(queue: Queue): MessageButton | null {
        return this.button(queue);
    }

    public translate(keys: LanguageKeyPath): string {
        return this.client.translate(this.guildId, keys);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        console.log(interaction);
        console.log(this.client.user?.id);
        console.log(this.guildId);
    }
}
