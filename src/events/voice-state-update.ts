import { AudioPlayer, AudioPlayerStatus } from '@discordjs/voice';
import { Guild, VoiceState } from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnVoiceStateUpdate extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
        this.name = 'voiceStateUpdate';
    }

    public async callback(
        voiceStatePrev: VoiceState,
        voiceStateAfter: VoiceState,
    ): Promise<void> {
        if (
            voiceStatePrev.channel?.id === voiceStateAfter.channel?.id &&
            voiceStatePrev.deaf === voiceStateAfter.deaf
        )
            return;
        const guild: Guild = voiceStateAfter.guild;
        const guildId: string = guild.id;
        if (
            voiceStateAfter.member?.id !== this.client.user?.id &&
            guild.me?.voice.channel
        ) {
            const audioPlayer: AudioPlayer | null =
                this.client.getAudioPlayer(guildId);
            if (
                (!audioPlayer ||
                    (audioPlayer.state.status !== AudioPlayerStatus.Playing &&
                        audioPlayer.state.status !==
                            AudioPlayerStatus.Paused)) &&
                voiceStateAfter.channel?.id === guild.me?.voice.channel.id &&
                ((voiceStatePrev.deaf && !voiceStateAfter.deaf) ||
                    (voiceStatePrev.channel?.id !==
                        voiceStateAfter.channel?.id &&
                        !voiceStateAfter.deaf))
            ) {
                this.client.musicActions.commands.execute('Play', guildId);
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
                    this.client.musicActions.updateQueueMessage({
                        queue: queue,
                        innactivity: innactivityDc,
                    });
            });
        }
        const prevId: string | undefined = voiceStatePrev.channel?.id;
        const afterId: string | undefined = voiceStateAfter.channel?.id;
        console.log(`Voice channel update: ${prevId} -> ${afterId}`);
    }
}
