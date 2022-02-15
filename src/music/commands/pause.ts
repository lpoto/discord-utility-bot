import { AudioPlayerStatus } from '@discordjs/voice';
import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from '../models';

export class Pause extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'pause', 'description']);
    }

    get button(): MessageButton {
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'pause', 'label']))
            .setDisabled(this.music.queue.size === 0)
            .setStyle(
                this.music.audioPlayer?.state.status ===
                    AudioPlayerStatus.Paused
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !this.music.audioPlayer) return;
        if (this.music.audioPlayer.state.status === AudioPlayerStatus.Paused) {
            this.music.audioPlayer.unpause();
        } else {
            this.music.audioPlayer.pause();
        }
        await this.music.actions.updateQueueMessageWithInteraction(
            interaction,
            false,
            true,
        );
    }
}
