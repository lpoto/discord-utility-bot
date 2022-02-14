import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { CommandName, MusicCommandOptions } from '.';
import { Command } from '../models';

export class Replay extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'replay', 'description']);
    }

    get button(): MessageButton {
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'replay', 'label']))
            .setDisabled(this.music.getQueueSize() === 0 || this.music.paused)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !this.music.audioPlayer || this.music.paused)
            return;
        this.music.audioPlayer.stop();
        this.music.timer?.stop();
        this.music.timer = null;
        this.music.commands.execute({
            name: CommandName.PLAY,
        });
        if (interaction) interaction.deferUpdate();
    }
}
