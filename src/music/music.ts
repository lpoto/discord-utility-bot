import { VoiceConnection } from '@discordjs/voice';
import { randomUUID } from 'crypto';
import {
    CommandInteraction,
    GuildMember,
    MessageActionRow,
    ThreadChannel,
    VoiceChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { LanguageKeyPath } from '../translation';
import { CommandName, executeCommand, getCommandsActionRow } from './commands';
import { MusicActions } from './music-actions';
import { SongQueue } from './song-queue';
import { QueueEmbed } from './utils';

export class Music {
    // should only be created from newMusic static method
    private musicClient: MusicClient;
    private musicGuildId: string;
    private songQueue: SongQueue | null;
    private musicThread: ThreadChannel | null;
    private offset: number;
    private isLoop: boolean;
    private isLoopQueue: boolean;
    private musicActions: MusicActions;

    constructor(client: MusicClient, guildId: string) {
        this.songQueue = null;
        this.musicThread = null;
        this.musicClient = client;
        this.musicGuildId = guildId;
        this.isLoop = false;
        this.isLoopQueue = false;
        this.offset = 0;
        this.musicActions = new MusicActions(this);
    }

    get client(): MusicClient {
        return this.musicClient;
    }

    get actions(): MusicActions {
        return this.musicActions;
    }

    get thread(): ThreadChannel | null {
        return this.musicThread;
    }

    set thread(value: ThreadChannel | null) {
        this.musicThread = value;
    }

    get queue(): SongQueue | null {
        return this.songQueue;
    }

    get loop(): boolean {
        return this.isLoop;
    }

    set loop(value: boolean) {
        if (value) this.loopQueue = false;
        this.loop = value;
    }

    get loopQueue(): boolean {
        return this.isLoopQueue;
    }

    set loopQueue(value: boolean) {
        if (value) this.loop = false;
        this.loop = value;
    }

    get guildId(): string {
        return this.musicGuildId;
    }

    get queueOffset(): number {
        return this.offset;
    }

    public incrementOffset() {
        this.offset += QueueEmbed.songsPerPage();
    }

    public decrementOffset() {
        this.offset =
            this.offset > 0 ? this.offset - QueueEmbed.songsPerPage() : 0;
    }

    public handleError(error: Error): void {
        return this.client.handleError(error);
    }


    public translate(keys: LanguageKeyPath) {
        return this.client.translate(this.musicGuildId, keys);
    }

    /** join the voice channel, send a queue message
     * and start a new music thread */
    public async setup(
        interaction: CommandInteraction,
    ): Promise<Music | null> {
        if (
            !interaction.member ||
            !(interaction.member instanceof GuildMember) ||
            !interaction.member.voice ||
            !interaction.member.voice.channel ||
            !(interaction.member.voice.channel instanceof VoiceChannel)
        )
            return this;
        if (
            interaction.member.voice.channel.full ||
            !interaction.member.voice.channel.joinable
        ) {
            await interaction.reply({
                content: this.translate([
                    'error',
                    'voice',
                    'client',
                    'cannotJoin',
                ]),
                ephemeral: true,
            });
            return null;
        }
        return this.initializeQueueMessage(interaction).then((result) => {
            if (!result) return this;
            return this.actions.joinVoice(interaction).then((result) => {
                if (result) return this;
                return null;
            });
        });
    }

    public execute(commandName: CommandName): void {
        executeCommand({ name: commandName, music: this });
    }

    /** Send a new queue message and start a new music thread */
    private async initializeQueueMessage(
        interaction: CommandInteraction,
    ): Promise<boolean> {
        if (!interaction.channel || !interaction.guild) return false;

        this.songQueue = new SongQueue();
        for (let i = 0; i < 11; i++) {
            this.songQueue.enqueue(randomUUID() + randomUUID());
        }
        const embed: QueueEmbed = new QueueEmbed(this);
        const components: MessageActionRow[] = [embed.getActionRow()];
        const commandActionRow: MessageActionRow | null = getCommandsActionRow(
            this,
        );
        if (commandActionRow) components.push(commandActionRow);
        return this.actions.replyWithQueue(interaction);
    }

    /** Create a new music object and initialize it properly.
     * Music object should always be created with this method */
    public static async newMusic(
        client: MusicClient,
        interaction: CommandInteraction,
    ): Promise<Music | null> {
        if (!interaction.guildId || !client.user) return null;
        const music: Music = new Music(client, interaction.guildId);
        if (!music) return null;
        return music.setup(interaction).then((music2) => {
            if (music2 && music2.client && music2.guildId && music2.thread)
                return music2;
            return null;
        });
    }
}
