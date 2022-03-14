import { joinVoiceChannel } from '@discordjs/voice';
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
        this.name = 'joinVoiceRequest';
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
                channelId: voiceChannelId,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfMute: false,
                selfDeaf: true,
            }).on('error', (error) => {
                this.client.emit('error', error);
                if (resource instanceof Interaction) {
                    resource
                        .reply({
                            content: this.client.translate(guild.id, [
                                'error',
                                'voice',
                                'failedJoining',
                            ]),
                            ephemeral: true,
                        })
                        .catch((e) => {
                            this.client.emit('error', e);
                        });
                } else {
                    resource
                        .reply({
                            content: this.client.translate(guild.id, [
                                'error',
                                'voice',
                                'failedJoining',
                            ]),
                        })
                        .catch((e) => {
                            this.client.emit('error', e);
                        });
                }
            }),
        );
    }
}
