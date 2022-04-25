import { Guild, VoiceState } from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { CustomAudioPlayer } from '../utils';
import { AbstractMusicEvent } from '../utils/abstract-music-event';

export class OnVoiceStateUpdate extends AbstractMusicEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(
        voiceStatePrev: VoiceState,
        voiceStateAfter: VoiceState,
    ): Promise<void> {
        if (!this.client.user) return;
        if (
            voiceStatePrev.channel?.id === voiceStateAfter.channel?.id &&
            voiceStatePrev.deaf === voiceStateAfter.deaf
        )
            return;
        const guild: Guild = voiceStateAfter.guild;
        const guildId: string = guild.id;
        if (voiceStateAfter.member?.id !== this.client.user?.id) {
            if (!guild.me?.voice.channel) return;
            const audioPlayer: CustomAudioPlayer | null =
                this.client.getAudioPlayer(guildId);
            if (
                (!audioPlayer || audioPlayer.idle) &&
                voiceStateAfter.channel?.id === guild.me?.voice.channel.id &&
                ((voiceStatePrev.deaf && !voiceStateAfter.deaf) ||
                    (voiceStatePrev.channel?.id !==
                        voiceStateAfter.channel?.id &&
                        !voiceStateAfter.deaf))
            ) {
                this.client.emitEvent('executeCommand', {
                    name: 'Play',
                    guildId: guildId,
                });
            }
            return;
        }
        if (voiceStatePrev.channel?.id === voiceStateAfter.channel?.id) return;
        if (
            (voiceStateAfter.channel?.id === undefined ||
                voiceStatePrev.channel?.id === undefined) &&
            this.client.user
        ) {
            let innactivityDc = false;
            if (voiceStateAfter.channel?.id === undefined) {
                this.client.destroyVoiceConnection(guildId);
                innactivityDc = true;
            }
            Queue.findOne({
                guildId: guildId,
                clientId: this.client.user.id,
            }).then((queue) => {
                if (queue)
                    this.client.emitEvent('queueMessageUpdate', {
                        queue: queue,
                        innactivity: innactivityDc,
                    });
            });
        }
        const prevId: string | undefined = voiceStatePrev.channel?.id;
        const afterId: string | undefined = voiceStateAfter.channel?.id;
        this.client.logger.debug(
            `Client voice state update in guild '${guildId}': ${prevId} -> ${afterId}`,
        );
    }
}

export namespace OnVoiceStateUpdate {
    export type Type = [
        'voiceStateUpdate',
        ...Parameters<OnVoiceStateUpdate['callback']>,
    ];
}
