import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from '../models';

export class Expand extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'expand', 'description']);
    }

    get button(): MessageButton | null {
        if (!this.music.editing) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'expand', 'label']))
            .setDisabled(this.music.getQueueSize() < 2)
            .setStyle(
                this.music.expanded
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user || !this.music.thread) return;
        this.music.expanded = !this.music.expanded;
        this.music.actions.updateQueueMessageWithInteraction(interaction);
    }
}
