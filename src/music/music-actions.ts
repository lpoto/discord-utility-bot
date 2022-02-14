import { joinVoiceChannel, VoiceConnection } from '@discordjs/voice';
import {
    ButtonInteraction,
    CommandInteraction,
    Guild,
    GuildMember,
    InteractionReplyOptions,
    Message,
    MessageActionRow,
    StartThreadOptions,
} from 'discord.js';
import { MusicClient } from '../client';
import { LanguageKeyPath } from '../translation';
import { CommandName } from './commands';
import { QueueEmbed } from './models';
import { Music } from './music';

export class MusicActions {
    private music: Music;

    constructor(music: Music) {
        this.music = music;
    }

    get connection(): VoiceConnection | null {
        return this.music.connection;
    }

    get client(): MusicClient {
        return this.music.client;
    }

    get commandActionRow(): MessageActionRow[] {
        return this.music.commands.getCommandsActionRow();
    }

    public translate(keys: LanguageKeyPath) {
        return this.music.translate(keys);
    }

    public handleError(error: Error): void {
        return this.music.handleError(error);
    }

    public leaveVoice(): void {
        this.connection?.destroy();
    }

    public async joinVoice(
        interaction: CommandInteraction | ButtonInteraction | null = null,
        message: Message | null = null,
        retry: number = 0,
    ): Promise<boolean> {
        let voiceChannelId: string;
        let guild: Guild;
        if (
            interaction &&
            interaction.member instanceof GuildMember &&
            interaction.member.voice.channel &&
            interaction.guild
        ) {
            voiceChannelId = interaction.member.voice.channel.id;
            guild = interaction.guild;
        } else if (
            message &&
            message.member &&
            message.member.voice.channel &&
            message.guild
        ) {
            voiceChannelId = message.member.voice.channel.id;
            guild = message.guild;
        } else {
            return false;
        }
        this.music.connection = joinVoiceChannel({
            channelId: voiceChannelId,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfMute: false,
            selfDeaf: true,
        })
            .on('stateChange', (statePrev, stateAfter) => {
                if (statePrev.status === stateAfter.status) return;

                console.log(
                    `State change ${guild.id}: ${statePrev.status} -> ${stateAfter.status}`,
                );
            })
            .on('error', (error) => {
                this.client.handleError(error);
                if (retry < 5) this.joinVoice(interaction, message, retry + 1);
            });
        return true;
    }

    public async songsToQueue(songNamesOrUrls: string[]): Promise<void> {
        try {
            let startPlaying: boolean = this.music.getQueueSize() === 0;
            const jmp = 5;
            for await (const i of songNamesOrUrls.length <= jmp
                ? songNamesOrUrls
                : songNamesOrUrls.slice(0, jmp)) {
                await this.music.enqueue(i);
                if (this.music.getQueueSize() === 1 || startPlaying) {
                    startPlaying = false;
                    this.music.commands.execute({ name: CommandName.PLAY });
                }
            }
            if (
                !this.music.timer?.isActive ||
                this.music.timer?.isPaused ||
                !this.music.guild.me?.voice.channel
            )
                this.updateQueueMessage();
            if (songNamesOrUrls.length > jmp)
                this.songsToQueue(songNamesOrUrls.slice(jmp));
        } catch (e) {
            console.error('Error addings songs to the queue: ', e);
        }
    }

    public async replyWithQueue(
        interaction: CommandInteraction,
    ): Promise<boolean> {
        const options: InteractionReplyOptions = this.getQueueOptions();
        return interaction
            .reply({
                fetchReply: true,
                embeds: options.embeds,
                components: options.components,
            })
            .then((message) => {
                if (!(message instanceof Message)) return false;
                return message
                    .startThread(this.getThreadOptions())
                    .then(async (thread) => {
                        if (thread) {
                            this.music.thread = thread;
                            return true;
                        }
                        message.delete().catch((error) => {
                            this.handleError(error);
                        });
                        return false;
                    });
            })
            .catch((error) => {
                this.handleError(error);
                return false;
            });
    }

    public async updateQueueMessageWithInteraction(
        interaction: ButtonInteraction,
    ): Promise<boolean> {
        if (!this.music.thread || interaction.deferred || interaction.replied)
            return false;
        return interaction
            .update(this.getQueueOptions())
            .then(() => {
                return true;
            })
            .catch((error) => {
                this.handleError(error);
                return false;
            });
    }

    public async updateQueueMessage(): Promise<boolean> {
        if (!this.music.thread) return false;
        return this.music.thread
            .fetchStarterMessage()
            .then((message) => {
                if (!message) return false;
                return message.edit(this.getQueueOptions()).then(() => {
                    return true;
                });
            })
            .catch((error) => {
                this.handleError(error);
                return false;
            });
    }

    private getQueueOptions(): InteractionReplyOptions {
        const embed: QueueEmbed = new QueueEmbed(this.music);
        const components: MessageActionRow[] = [];
        const commandActionRow: MessageActionRow[] = this.commandActionRow;
        for (const row of commandActionRow) components.push(row);
        return {
            fetchReply: true,
            embeds: [embed],
            components: components,
        };
    }

    private getThreadOptions(): StartThreadOptions {
        return {
            name: this.translate(['music', 'thread', 'name']),
            reason: this.translate(['music', 'thread', 'reason']),
        };
    }
}
