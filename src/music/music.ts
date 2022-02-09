import { joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import {
    CommandInteraction,
    Guild,
    GuildMember,
    Message,
    MessageEmbed,
    ThreadChannel,
    VoiceChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { CommandName, fetchCommand } from './commands';
import { SongQueue } from './song-queue';

export class Music {
    // should only be created from newMusic static method
    private client: MusicClient;
    private guildId: string;
    private queueMessage: Message | null;
    private songQueue: SongQueue | null;
    private musicThread: ThreadChannel | null;

    constructor(client: MusicClient, guildId: string) {
        this.queueMessage = null;
        this.songQueue = null;
        this.musicThread = null;
        this.client = client;
        this.guildId = guildId;
    }

    get thread() {
        return this.musicThread;
    }

    get queue(): SongQueue | null {
        return this.songQueue;
    }

    get size(): number {
        if (!this.queue) this.songQueue = new SongQueue();
        return this.queue ? this.queue.size : 0;
    }

    get message(): Message | null {
        return this.queueMessage;
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
        const voiceChannel: VoiceChannel | null =
            interaction.member.voice.channel;
        const guild: Guild | null = interaction.guild;
        if (voiceChannel.full || !voiceChannel.joinable) {
            await interaction.reply({
                content: this.client.lang.error.cannotJoinVoice,
                ephemeral: true,
            });
            return null;
        }
        return this.initializeQueueMessage(interaction).then((result) => {
            if (!result || !voiceChannel || !guild) return this;
            this.songQueue = new SongQueue();

            joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfMute: false,
            }).on('stateChange', (statePrev, stateAfter) => {
                if (statePrev.status === stateAfter.status) return;
                console.log(
                    `State change: ${statePrev.status} -> ${stateAfter.status}`,
                );
                if (
                    stateAfter.status === VoiceConnectionStatus.Destroyed ||
                    stateAfter.status === VoiceConnectionStatus.Disconnected
                )
                    this.destroy();
            });
            return this;
        });
    }

    public async execute(commandName: CommandName): Promise<void> {
        fetchCommand(commandName, this)
            ?.execute()
            .catch((error) => {
                console.log(`Error when executing ${commandName}:`, error);
            });
    }

    /** Archive the music thread, delete the queue message and remove the Music
     * object from the client's music dictionary */
    private destroy(): void {
        if (this.guildId in this.client.musics)
            delete this.client.musics[this.guildId];
        if (this.client.user?.id)
            Music.archiveMusicThread(this.thread, this.client.user.id);
    }

    private queueMessageContent(): MessageEmbed {
        return new MessageEmbed({
            title: 'Music Queue',
            description: 'IDK MAN',
        });
    }

    /** Send a new queue message and start a new music thread */
    private async initializeQueueMessage(
        interaction: CommandInteraction,
    ): Promise<boolean> {
        if (!interaction.channel || !interaction.guild) return false;

        return interaction
            .reply({ embeds: [this.queueMessageContent()], fetchReply: true })
            .then((message) => {
                if (!(message instanceof Message)) return false;

                this.queueMessage = message;
                return message
                    .startThread({
                        name: Music.musicThreadName,
                        reason: 'Adding songs to the queue',
                    })
                    .then(async (thread) => {
                        if (!thread) return false;
                        this.musicThread = thread;
                        await thread
                            .send('Type the name or the url of a song!')
                            .catch(() => {});
                        if (!message.deletable) return false;
                        try {
                            message.delete();
                            return true;
                        } catch (error) {
                            return false;
                        }
                    })
                    .catch(() => {
                        if (!message.deletable) return false;
                        try {
                            message.delete();
                            return true;
                        } catch (error) {
                            return false;
                        }
                    });
            })
            .catch((error) => {
                console.log('Error when initializing queue message:', error);
                return false;
            });
    }

    static get slashCommand(): { [key: string]: string } {
        return {
            name: 'music',
            description: 'Starts a new music thread!',
        };
    }

    static get musicThreadName(): string {
        return 'Music thread';
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
            if (
                music2 &&
                music2.client &&
                music2.guildId &&
                music2.queueMessage
            )
                return music2;
            return null;
        });
    }

    /** Archive a music thread, delete it if possible and delete
     * the queue message */
    public static async archiveMusicThread(
        thread: ThreadChannel | null,
        clientId: string,
    ): Promise<void> {
        if (
            !thread ||
            !thread.guild ||
            !thread.parentId ||
            thread.name !== Music.musicThreadName ||
            thread.ownerId !== clientId
        )
            return;
        thread.fetchStarterMessage().then(async (message) => {
            if (!message || !message.deletable) return;
            try {
                await message.delete();
            } catch (error) {
                return error;
            }
        });
        thread.setName('Used to be a music thread...').then(() => {
            thread
                .setArchived()
                .then(() => {
                    console.log(`Archived thread: ${thread.id}`);
                })
                .catch(() => {
                    console.log('Could not archive the thread!');
                })
                .then(() => {
                    thread.delete().then(() => {
                        console.log(`Deleted thread: ${thread.id}`);
                    });
                })
                .catch(() => {
                    console.log('Could not delete the thread!');
                });
        });
    }
}
