import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { QueueEmbed } from '../models';
import { MusicCommandOptions } from '.';
import { Command } from '../models';

export class PageForward extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    get description(): string {
        return this.translate([
            'music',
            'commands',
            'pageForward',
            'description',
        ]);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user || !this.music.thread) return;

        return this.music.incrementOffset().then(() => {
            this.music.actions.updateQueueMessageWithInteraction(interaction);
        });
    }

    get button(): MessageButton | null {
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'pageForward', 'label']),
            )
            .setDisabled(
                this.music.queueOffset + QueueEmbed.songsPerPage() >=
                    this.music.queue.size - 1,
            )
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }
}
