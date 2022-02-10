import { joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import {
    CommandInteraction,
    GuildMember,
    InteractionReplyOptions,
    Message,
    MessageActionRow,
    MessageEditOptions,
    StartThreadOptions,
    VoiceChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { LanguageKeyPath } from '../translation';
import { getCommandsActionRow } from './commands';
import { Music } from './music';
import { QueueEmbed } from './utils';

export class MusicActions {
    private music: Music;
    private connection: VoiceConnection | null;

    constructor(music: Music) {
        this.music = music;
        this.connection = null;
    }

    get client(): MusicClient {
        return this.music.client;
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
        this.connection = joinVoiceChannel({
            channelId: interaction.member.voice.channel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfMute: true,
            selfDeaf: true,
        }).on('stateChange', (statePrev, stateAfter) => {
                if (statePrev.status === stateAfter.status) return;

                console.log(
                    `State change: ${statePrev.status} -> ${stateAfter.status}`,
                );

                if (stateAfter.status === VoiceConnectionStatus.Disconnected)
                    if (interaction.guildId)
                        this.client.destroyMusic(interaction.guildId);
        });
        return true;
    }

    public async replyWithQueue(
        interaction: CommandInteraction,
    ): Promise<boolean> {
        const options: InteractionReplyOptions = this.getQueueOptions() as InteractionReplyOptions;
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

    public async updateQueueMessage(): Promise<boolean> {
        if (!this.music.thread) return false;
        return this.music.thread
            .fetchStarterMessage()
            .then((message) => {
                if (!message) return false;
                return message
                    .edit(this.getQueueOptions() as MessageEditOptions)
                    .then(() => {
                        return true;
                    });
            })
            .catch((error) => {
                this.handleError(error);
                return false;
            });
    }

    private getQueueOptions(): InteractionReplyOptions | MessageEditOptions {
        const embed: QueueEmbed = new QueueEmbed(this.music);
        const components: MessageActionRow[] = [embed.getActionRow()];
        const commandActionRow: MessageActionRow | null = getCommandsActionRow(
            this.music,
        );
        if (commandActionRow) components.push(commandActionRow);
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
