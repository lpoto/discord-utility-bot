import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from '../models';

export class Pause extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !this.music.audioPlayer) return;
        if (this.music.paused) this.music.audioPlayer.unpause();
        else this.music.audioPlayer.pause();
        this.music.paused = !this.music.paused;
        await this.music.actions.updateQueueMessageWithInteraction(
            interaction,
        );
    }

    get button(): MessageButton {
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'actionRow', 'pause']),
            )
            .setDisabled(this.music.queue?.size === 0)
            .setStyle(
                this.music.paused
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }
}
