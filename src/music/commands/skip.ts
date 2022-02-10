import { MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from './command';

export class Skip extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    get button(): MessageButton {
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'actionRow', 'skip']),
            )
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }
}
