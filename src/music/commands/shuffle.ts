import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from '../models';

export class Shuffle extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            !interaction.user ||
            !this.music.thread ||
            !this.music.queue
        )
            return;
        this.music.queue.shuffle().then(() => {
            this.music.actions.updateQueueMessageWithInteraction(interaction);
        });
    }

    get button(): MessageButton | null {
        if (!this.music.editing) return null;
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'actionRow', 'shuffle']),
            )
            .setDisabled(!this.music.queue || this.music.queue?.size < 3)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }
}
