import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { CommandName, MusicCommandOptions } from '.';
import { Command } from './command';

export class Replay extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !this.music.audioPlayer || this.music.paused)
            return;
        this.music.audioPlayer.stop();
        this.music.updater.resetTimer();
        this.music.updater.needsUpdate();
        this.music.commands.execute({
            name: CommandName.PLAY,
        });
        if (interaction) interaction.deferUpdate();
    }

    get button(): MessageButton {
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'actionRow', 'replay']),
            )
            .setDisabled(this.music.queue?.size === 0 || this.music.paused)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }
}
