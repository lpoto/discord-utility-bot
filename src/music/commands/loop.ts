import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from '../models';

export class Loop extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'loop', 'description']);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            !interaction.user ||
            !this.music.thread ||
            !this.music.queue
        )
            return;
        this.music.loop = !this.music.loop;
        if (this.music.loop) this.music.loopQueue = false;
        this.music.actions.updateQueueMessageWithInteraction(interaction);
    }

    get button(): MessageButton | null {
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'loop', 'label']))
            .setDisabled(!this.music.queue || this.music.queue.size < 1)
            .setStyle(
                this.music.loop
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }
}
