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
            .setDisabled(this.music.getQueueSize() === 0)
            .setStyle(
                this.music.paused
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !this.music.audioPlayer) return;
        if (this.music.paused) {
            this.music.timer?.unpause();
            this.music.audioPlayer.unpause();
        } else {
            this.music.timer?.pause();
            this.music.audioPlayer.pause();
        }
        this.music.paused = !this.music.paused;
        await this.music.actions.updateQueueMessageWithInteraction(
            interaction,
        );
    }
}
