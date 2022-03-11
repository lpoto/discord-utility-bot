import { AudioPlayerStatus } from '@discordjs/voice';
import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractCommand } from '../models';

export class Pause extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string {
        return this.translate(['music', 'commands', 'pause', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'pause', 'label']))
            .setDisabled(queue.size === 0)
            .setStyle(
                this.audioPlayer?.state.status === AudioPlayerStatus.Paused
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !this.audioPlayer || !this.connection) return;

        const queue: Queue | undefined = await this.getQueue();
        const audioPlayer = this.audioPlayer;
        if (!queue || !audioPlayer) return;
        if (audioPlayer.state.status === AudioPlayerStatus.Paused)
            audioPlayer.unpause();
        else audioPlayer.pause();
        this.client.musicActions.updateQueueMessage({
            interaction: interaction,
            queue: queue,
            componentsOnly: true,
        });
    }
}
