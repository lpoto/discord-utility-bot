import {
    Guild,
    Message,
    MessageEmbed,
    TextChannel,
    VoiceChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { CommandName, fetchCommand } from './commands';
import { SongQueue } from './song-queue';

export class Music {
    // should only be created from newMusic static method
    private client: MusicClient;
    private isReady;
    private musicGuild: Guild | null;
    private textChannel: TextChannel | null;
    private queueMessage: Message | null;
    private voiceChannel: VoiceChannel | null;
    private songQueue: SongQueue | null;

    constructor(client: MusicClient) {
        this.client = client;
        this.isReady = false;
        this.musicGuild = null;
        this.textChannel = null;
        this.queueMessage = null;
        this.voiceChannel = null;
        this.songQueue = null;
    }

    get ready(): boolean {
        return this.isReady;
    }

    get queue(): SongQueue | null {
        return this.songQueue;
    }

    get size(): number {
        if (!this.ready) return 0;
        if (!this.queue) this.songQueue = new SongQueue();
        return this.queue ? this.queue.size : 0;
    }

    get message(): Message | null {
        return this.queueMessage;
    }

    get guild(): Guild | null {
        return this.musicGuild;
    }

    get channel(): VoiceChannel | null {
        return this.voiceChannel;
    }

    set channel(value: VoiceChannel | null) {
        this.voiceChannel = value;
    }

    public async setup(
        guildId: string,
        voiceChannelId: string,
        textChannelId: string,
    ): Promise<void> {
        this.client.guilds
            .fetch(guildId)
            .then((guild: Guild) => {
                this.musicGuild = guild;
                this.fetchChannels(textChannelId, voiceChannelId).then(
                    (result) => {
                        if (!result) return;
                        this.initializeQueueMessage().then((result2) => {
                            if (!result2) return;
                            this.songQueue = new SongQueue();
                            this.isReady =
                                this.songQueue !== null &&
                                this.songQueue !== undefined;
                        });
                    },
                );
            })
            .catch((error) => {
                console.log('Error when calling Music object setup:', error);
            });
    }

    public async execute(commandName: CommandName): Promise<void> {
        fetchCommand(commandName, this)
            ?.execute()
            .catch((error) => {
                console.log(`Error when executing ${commandName}:`, error);
            });
    }

    private queueMessageContent(): MessageEmbed {
        return new MessageEmbed({
            title: 'Hello world!',
            description: 'TODO',
        });
    }

    private async initializeQueueMessage(): Promise<boolean> {
        if (!this.textChannel || !this.musicGuild || !this.voiceChannel)
            return false;
        return this.textChannel
            .send({ embeds: [this.queueMessageContent()] })
            .then((message: Message) => {
                this.queueMessage = message;
                return true;
            })
            .catch((error) => {
                console.log('Error when sending queue message:', error);
                return false;
            });
    }

    private async fetchChannels(
        textChannelId: string,
        voiceChannelId: string,
    ): Promise<boolean> {
        if (!this.musicGuild) return false;
        return this.musicGuild.channels
            .fetch(textChannelId)
            .then((textChannel) => {
                if (
                    !this.musicGuild ||
                    !textChannel ||
                    !(textChannel instanceof TextChannel)
                )
                    return false;
                this.textChannel = textChannel;
                return this.musicGuild.channels
                    .fetch(voiceChannelId)
                    .then((voiceChannel) => {
                        if (
                            !voiceChannel ||
                            !(voiceChannel instanceof VoiceChannel)
                        )
                            return false;
                        this.voiceChannel = voiceChannel;
                        return true;
                    });
            })
            .catch((error) => {
                console.log('Error when fetching channels:', error);
                return false;
            });
    }

    public static async newMusic(
        client: MusicClient,
        guildId: string,
        voiceChannelId: string,
        textChannelId: string,
    ): Promise<Music | null> {
        const music: Music = new Music(client);
        if (!music) return null;
        return music.setup(guildId, voiceChannelId, textChannelId).then(() => {
            if (!music.ready) return null;
            return music;
        });
    }
}
