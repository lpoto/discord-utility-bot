import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from './command';

export class Pause extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction) return;
        this.music.paused = !this.music.paused;
        //TODO if this.music.paused === true and music is playing pause it
        await this.music.actions.updateQueueMessageWithInteraction(interaction);
    }


    get button(): MessageButton {
        return new MessageButton()
            .setLabel(
                this.translate([
                    'music',
                    'commands',
                    'actionRow',
                    'pause',
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
