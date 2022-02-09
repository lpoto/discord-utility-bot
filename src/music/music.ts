import { joinVoiceChannel, VoiceConnection } from '@discordjs/voice';
import {
    CommandInteraction,
    Guild,
    GuildMember,
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
    private queueMessage: Message | null;
    private songQueue: SongQueue | null;

    constructor() {
        this.queueMessage = null;
        this.songQueue = null;
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
        const voiceChannel: VoiceChannel | null = interaction.member.voice.channel;
        const guild: Guild | null = interaction.guild;
        if (voiceChannel.full || !voiceChannel.joinable) {
            await interaction.reply({
                content: 'Cannot join your voice channel!',
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
                adapterCreator: guild.voiceAdapterCreator
            })
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

    private queueMessageContent(): MessageEmbed {
        return new MessageEmbed({
            title: 'Music Queue',
            description: 'IDK MAN',
        });
    }

    private async initializeQueueMessage(
        interaction: CommandInteraction,
    ): Promise<boolean> {
        if (!interaction.channel || !interaction.guild)
            return false;
        return interaction
            .reply({ embeds: [this.queueMessageContent()], fetchReply: true })
            .then((message) => {
                if (message instanceof Message) {
                    this.queueMessage = message;
                    message.startThread({
                        name: 'Music thread',
                        reason: 'Adding songs to the queue',
                    });
                    return true;
                }
                return false;
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

    public static async newMusic(
        interaction: CommandInteraction,
    ): Promise<Music | null> {
        const music: Music = new Music();
        if (!music) return null;
        return music.setup(interaction).then((music) => {
            if (music) return null;
            return music;
        });
    }
}
