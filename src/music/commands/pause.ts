import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from './command';

export class Pause extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (interaction)
            await interaction.reply({
                content: 'Sori poba, tole pa se ne deva ejga...',
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
                    'pauseResume',
                ]),
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
