import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from '../models';

export class PageBackward extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    get description(): string {
        return this.translate([
            'music',
            'commands',
            'pageBackward',
            'description',
        ]);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            !interaction.user ||
            !this.music.thread ||
            !this.music.queue
        )
            return;

        return this.music.decrementOffset().then(() => {
            this.music.actions.updateQueueMessageWithInteraction(interaction);
        });
    }

    get button(): MessageButton | null {
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'pageBackward', 'label']),
            )
            .setDisabled(this.music.queueOffset === 0)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }
}
