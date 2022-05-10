import {
    DiscordGatewayAdapterCreator,
    joinVoiceChannel,
    VoiceConnectionStatus,
} from '@discordjs/voice';
import {
    ButtonInteraction,
    CommandInteraction,
    Guild,
    GuildMember,
    Interaction,
    Message,
    SelectMenuInteraction,
} from 'discord.js';
import { MusicClient } from '../client';
import { AbstractMusicEvent } from '../utils/abstract-music-event';

export class OnJoinVoiceRequest extends AbstractMusicEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(
        resource:
            | Message
            | CommandInteraction
            | ButtonInteraction
            | SelectMenuInteraction,
    ): Promise<void> {
        let vcId: string;
        let guild: Guild;
        if (
            !(resource instanceof Message) &&
            resource.member instanceof GuildMember &&
            resource.member.voice.channel &&
            resource.guild
        ) {
            vcId = resource.member.voice.channel.id;
            guild = resource.guild;
        } else if (
            resource instanceof Message &&
            resource.member &&
            resource.member.voice.channel &&
            resource.guild
        ) {
            vcId = resource.member.voice.channel.id;
            guild = resource.guild;
        } else return;

        if (
            this.client.getVoiceConnection(guild.id)?.state.status ===
            VoiceConnectionStatus.Ready
        )
            return;

        this.client.logger.debug(
            `Joining voice channel '${vcId}' in guild: '${guild.id}'`,
        );

        this.client.setVoiceConnection(
            guild.id,
            joinVoiceChannel({
                guildId: guild.id,
                channelId: vcId,
                selfDeaf: true,
                selfMute: false,
                adapterCreator:
                    guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
            }).on('error', (error) => {
                this.client.emitEvent('error', error);
                if (resource instanceof Interaction) {
                    resource
                        .reply({
                            content: this.client.translate([
                                'common',
                                'errors',
                                'voice',
                                'failedJoining',
                            ]),
                            ephemeral: true,
                        })
                        .catch((e) => {
                            this.client.emitEvent('error', e);
                        });
                } else {
                    resource
                        .reply({
                            content: this.client.translate([
                                'common',
                                'errors',
                                'voice',
                                'failedJoining',
                            ]),
                        })
                        .catch((e) => {
                            this.client.emitEvent('error', e);
                        });
                }
            }),
        );
    }
}

export namespace OnJoinVoiceRequest {
    export type Type = [
        'joinVoiceRequest',
        ...Parameters<OnJoinVoiceRequest['callback']>,
    ];
}
