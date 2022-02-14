import {
    joinVoiceChannel,
    VoiceConnection,
    VoiceConnectionStatus,
} from '@discordjs/voice';
import {
    ButtonInteraction,
    CommandInteraction,
    GuildMember,
    InteractionReplyOptions,
    Message,
    MessageActionRow,
    StartThreadOptions,
    VoiceChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { LanguageKeyPath } from '../translation';
import { CommandName } from './commands';
import { QueueEmbed } from './models';
import { Music } from './music';

export class MusicActions {
    private music: Music;
    private interval: number;
    private stopUpdating: boolean;

    constructor(music: Music) {
        this.music = music;
        this.interval = 3000;
        this.stopUpdating = false;
        this.updateOnInterval();
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

    public stopUpdatingQueue(): void {
        this.stopUpdating = true;
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

    public async joinVoice(interaction: CommandInteraction): Promise<boolean> {
        if (
            !interaction.member ||
            !interaction.guild ||
            !(interaction.member instanceof GuildMember) ||
            !interaction.member.voice ||
            !interaction.member.voice.channel ||
            !(interaction.member.voice.channel instanceof VoiceChannel)
        )
            return false;
        let dc = false;
        this.music.connection = joinVoiceChannel({
            channelId: interaction.member.voice.channel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfMute: false,
            selfDeaf: true,
        })
            .on('stateChange', (statePrev, stateAfter) => {
                if (statePrev.status === stateAfter.status) return;

                console.log(
                    `State change ${interaction.guildId}: ${statePrev.status} -> ${stateAfter.status}`,
                );

                if (stateAfter.status === VoiceConnectionStatus.Disconnected) {
                    dc = true;
                    setTimeout(() => {
                        if (interaction.guildId && dc)
                            this.client.destroyMusic(interaction.guildId);
                    }, 2000);
                } else {
                    dc = false;
                }
            })
            .on('error', (error) => {
                this.client.handleError(error);
                this.joinVoice(interaction);
            });
        return true;
    }

    public songsToQueue(songNamesOrUrls: string[]): void {
        if (!this.music.queue) return;
        let startPlaying: boolean = this.music.queue.size === 0;
        for (const n of songNamesOrUrls) {
            this.music.queue.enqueue(n).then(() => {
                this.music.needsUpdate = true;
                if (
                    (this.music.queue && this.music.queue.size === 1) ||
                    startPlaying
                ) {
                    startPlaying = false;
                    this.music.commands.execute({ name: CommandName.PLAY });
                }
            });
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
                this.music.needsUpdate = false;
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
                    this.music.needsUpdate = false;
                    return true;
                });
            })
            .catch((error) => {
                this.handleError(error);
                return false;
            });
    }

    public updateOnInterval(): void {
        let repeated = 0;
        setTimeout(() => {
            try {
                if (this.music.needsUpdate) {
                    this.music.needsUpdate = false;
                    this.updateQueueMessage();
                }
                repeated++;
                if (!this.stopUpdating && repeated <= 10)
                    this.updateOnInterval();
            } catch (error) {
                console.error('Error when updating on interval: ', error);
            }
        }, this.interval);
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
