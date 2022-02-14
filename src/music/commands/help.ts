import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from '../models';

export class Help extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            !interaction.user ||
            interaction.replied ||
            !this.music.thread
        )
            return;

        const descriptions: string[] =
            this.music.commands.getAllDescriptions();
        if (this.description?.length === 0) {
            interaction.reply({
                content: this.translate(['help']),
                ephemeral: true,
            });
        } else {
            interaction.reply({
                content: descriptions
                    .map((d) => {
                        return '*\u3000' + d;
                    })
                    .join('\n'),
                ephemeral: true,
            });
        }
    }

    get button(): MessageButton | null {
        if (!this.music.editing) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'help', 'label']))
            .setDisabled(false)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }
}
