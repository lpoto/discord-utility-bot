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
import { LanguageKeyPath } from '../translation';
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

    public translate(keys: LanguageKeyPath) {
        return this.client.translate(this.guildId, keys);
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
        fetchCommand(commandName, this)?.execute();
    }

    /** Archive the music thread, delete the queue message and remove the Music
     * object from the client's music dictionary */
    private destroy(): void {
        console.log(`Destroy music in guild: ${this.guildId}`);

        if (this.guildId in this.client.musics)
            delete this.client.musics[this.guildId];
        if (this.client.user?.id)
            Music.archiveMusicThread(this.thread, this.client);
    }

    private queueMessageContent(): MessageEmbed {
        return new MessageEmbed({
            title: this.translate(['music', 'queue', 'title']),
            footer: { text: this.translate(['music', 'queue', 'footer']) },
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
                        name: this.translate(['music', 'thread', 'name']),
                        reason: this.translate(['music', 'thread', 'reason']),
                    })
                    .then(async (thread) => {
                        if (thread) {
                            this.musicThread = thread;
                            return true;
                        }
                        message.delete().catch((error) => {
                            this.client.handleError(error);
                        });
                        return false;
                    })
                    .catch(() => {
                        if (!message.deletable) return false;
                        message.delete().catch((error) => {
                            this.client.handleError(error);
                        });
                        return false;
                    });
            })
            .catch((error) => {
                this.client.handleError(error);
                return false;
            });
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
        client: MusicClient,
    ): Promise<void> {
        if (
            !thread ||
            !thread.guild ||
            !thread.guildId ||
            !thread.parentId ||
            thread.ownerId !== client.user?.id
        )
            return;
        thread
            .fetchStarterMessage()
            .then(async (message) => {
                if (!message || !message.deletable) return;
                try {
                    await message.delete();
                } catch (error) {
                    return error;
                }
            })
            .catch((error) => {
                client.handleError(error);
            });
        thread
            .setName(
                client.translate(thread.guildId, [
                    'music',
                    'thread',
                    'archivedName',
                ]),
            )
            .then(() => {
                thread
                    .setArchived()
                    .then(() => {
                        console.log(`Archived thread: ${thread.id}`);
                    })
                    .catch(() => {
                        console.log('Could not archive the thread!');
                    })
                    .then(() => {
                        thread
                            .delete()
                            .then(() => {
                                console.log(`Deleted thread: ${thread.id}`);
                            })
                            .catch((error) => {
                                client.handleError(error);
                            });
                    })
                    .catch(() => {
                        console.log('Could not delete the thread!');
                    });
            });
    }
}
