import {
    AudioPlayerStatus,
    joinVoiceChannel,
    VoiceConnection,
} from '@discordjs/voice';
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
        let idx = 0;
        for (const song of songNamesOrUrls) {
            await this.music.queue.enqueue(song);
            if (
                this.music.audioPlayer?.state.status !==
                    AudioPlayerStatus.Playing &&
                this.music.audioPlayer?.state.status !==
                    AudioPlayerStatus.Paused
            ) {
                this.music.commands.execute({ name: CommandName.PLAY });
            }
            idx++;
            if (
                !this.music.timer.isActive &&
                (idx === songNamesOrUrls.length - 1 || idx % 5 === 0)
            ) {
                this.updateQueueMessage();
            }
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
        embedOnly?: boolean,
        componentsOnly?: boolean,
    ): Promise<boolean> {
        if (!this.music.thread || interaction.deferred || interaction.replied)
            return false;
        return interaction
            .update(this.getQueueOptions(embedOnly, componentsOnly))
            .then(() => {
                return true;
            })
            .catch((error) => {
                this.handleError(error);
                return false;
            });
    }

    public async updateQueueMessage(
        embedOnly?: boolean,
        componentsOnly?: boolean,
    ): Promise<boolean> {
        if (!this.music.thread) return false;
        return this.music.thread
            .fetchStarterMessage()
            .then((message) => {
                if (!message) return false;
                return message
                    .edit(this.getQueueOptions(embedOnly, componentsOnly))
                    .then(() => {
                        return true;
                    });
            })
            .catch((error) => {
                this.handleError(error);
                return false;
            });
    }

    private getQueueOptions(
        embedOnly?: boolean,
        componentsOnly?: boolean,
    ): InteractionReplyOptions {
        if (embedOnly) {
            return {
                embeds: [new QueueEmbed(this.music)],
            };
        }
        const components: MessageActionRow[] = [];
        const commandActionRow: MessageActionRow[] = this.commandActionRow;
        for (const row of commandActionRow) components.push(row);
        if (componentsOnly) {
            return {
                components: components,
            };
        }
        return {
            embeds: [new QueueEmbed(this.music)],
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
