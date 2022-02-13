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
import { Music } from './music';
import { QueueEmbed } from './utils';

export class MusicActions {
    private music: Music;
    private connection: VoiceConnection | null;

    constructor(music: Music) {
        this.music = music;
        this.connection = null;
    }

    get con(): VoiceConnection | null {
        return this.connection;
    }

    get client(): MusicClient {
        return this.music.client;
    }

    get commandActionRow(): MessageActionRow[] | null {
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
        this.connection = joinVoiceChannel({
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
                    }, 10000);
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

    public async executeActionFromInteraction(
        interaction: ButtonInteraction,
    ): Promise<boolean> {
        if (!interaction.component) return false;
        switch (interaction.component.label) {
            case this.translate(['music', 'actionRow', 'pageForward']):
                return await this.changeQueueSongsOffset(true, interaction);
            case this.translate(['music', 'actionRow', 'pageBackward']):
                return await this.changeQueueSongsOffset(false, interaction);
            case this.translate(['music', 'actionRow', 'loop']):
                return await this.loopSong(interaction);
            case this.translate(['music', 'actionRow', 'loopQueue']):
                return await this.loopQueue(interaction);
            default:
                return false;
        }
    }

    public async changeQueueSongsOffset(
        increment: boolean = true,
        interaction: ButtonInteraction,
    ): Promise<boolean> {
        if (increment)
            return this.music.incrementOffset().then(() => {
                return this.updateQueueMessageWithInteraction(interaction);
            });
        return this.music.decrementOffset().then(() => {
            return this.updateQueueMessageWithInteraction(interaction);
        });
    }

    public async loopSong(interaction: ButtonInteraction): Promise<boolean> {
        this.music.loop = !this.music.loop;
        return this.updateQueueMessageWithInteraction(interaction);
    }

    public async loopQueue(interaction: ButtonInteraction): Promise<boolean> {
        this.music.loopQueue = !this.music.loopQueue;
        return this.updateQueueMessageWithInteraction(interaction);
    }

    public songsToQueue(songNamesOrUrls: string[]): void {
        if (!this.music.queue) return;
        let startPlaying: boolean = this.music.queue.size === 0;
        for (const n of songNamesOrUrls) {
            this.music.queue.enqueue(n).then(() => {
                this.music.updater.needsUpdate();
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
        if (!this.music.thread) return false;
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
        const components: MessageActionRow[] = [embed.getActionRow()];
        const commandActionRow: MessageActionRow[] | null =
            this.commandActionRow;
        if (commandActionRow)
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
