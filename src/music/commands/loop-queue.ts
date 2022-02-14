import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from '../models';

export class LoopQueue extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    get description(): string {
        return this.translate([
            'music',
            'commands',
            'loopQueue',
            'description',
        ]);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user || !this.music.thread) return;
        this.music.loopQueue = !this.music.loopQueue;
        if (this.music.loopQueue) this.music.loop = false;
        this.music.actions.updateQueueMessageWithInteraction(interaction);
    }

    get button(): MessageButton | null {
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'loopQueue', 'label']),
            )
            .setDisabled(this.music.getQueueSize() < 1)
            .setStyle(
                this.music.loopQueue
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }
}
