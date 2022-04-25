import {
    DiscordGatewayAdapterCreator,
    joinVoiceChannel,
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
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnJoinVoiceRequest extends AbstractClientEvent {
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
        let voiceChannelId: string;
        let guild: Guild;
        if (
            !(resource instanceof Message) &&
            resource.member instanceof GuildMember &&
            resource.member.voice.channel &&
            resource.guild
        ) {
            voiceChannelId = resource.member.voice.channel.id;
            guild = resource.guild;
        } else if (
            resource instanceof Message &&
            resource.member &&
            resource.member.voice.channel &&
            resource.guild
        ) {
            voiceChannelId = resource.member.voice.channel.id;
            guild = resource.guild;
        } else return;

        this.client.setVoiceConnection(
            guild.id,
            joinVoiceChannel({
                guildId: guild.id,
                channelId: voiceChannelId,
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
                                'error',
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
                                'error',
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
        ...Parameters<OnJoinVoiceRequest['callback']>
    ];
}
