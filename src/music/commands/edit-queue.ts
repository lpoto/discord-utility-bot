import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from '../models';

export class EditQueue extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user || !this.music.thread) return;
        this.music.editing = !this.music.editing;
        this.music.actions.updateQueueMessageWithInteraction(interaction);
    }

    get button(): MessageButton | null {
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'actionRow', 'edit']),
            )
            .setDisabled(false)
            .setStyle(
                this.music.editing
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }
}
