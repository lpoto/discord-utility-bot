import { AudioPlayerStatus } from '@discordjs/voice';
import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { CommandName } from '.';
import { MusicClient } from '../client';
import { Queue, Song } from '../entities';
import { AbstractCommand } from '../models';

export class Replay extends AbstractCommand {
    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'replay', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'replay', 'label']))
            .setDisabled(
                queue.songs.length === 0 ||
                    this.audioPlayer?.state.status ===
                        AudioPlayerStatus.Paused,
            )
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            !this.audioPlayer ||
            this.audioPlayer.state.status === AudioPlayerStatus.Paused
        )
            return;
        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;

        this.audioPlayer.stop();
        this.audioPlayer.removeAllListeners();
        this.client.setAudioPlayer(queue.guildId, null);
        this.client.musicActions.commands.execute(
            CommandName.PLAY,
            this.guildId,
        );

        if (interaction && !interaction.deferred && !interaction.replied)
            interaction.deferUpdate().catch((e) => this.client.handleError(e));
    }
}
