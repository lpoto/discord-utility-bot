import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from './command';

export class EditQueue extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user || !this.music.thread) return;
        interaction.reply({
            content: 'Sori poba, tole pa se ne deva...',
            ephemeral: true,
        });
    }

    get button(): MessageButton {
        return new MessageButton()
            .setLabel(
                this.translate([
                    'music',
                    'commands',
                    'actionRow',
                    'removeFromQueue',
                ]),
            )
            .setDisabled(!this.music.queue || this.music.queue?.size < 2)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }
}