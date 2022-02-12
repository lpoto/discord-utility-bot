import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { CommandName, MusicCommandOptions } from '.';
import { Song } from '../song';
import { Command } from './command';

export class Skip extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !this.music.audioPlayer || this.music.paused)
            return;
        if (!this.music.loop) {
            const s: Song | undefined | null = this.music.queue?.dequeue();
            if (s && this.music.loopQueue) this.music.queue?.enqueueSong(s);
            this.music.actions.updateQueueMessage();
        }
        this.music.audioPlayer.stop();
        this.music.commands.execute({
            name: CommandName.PLAY,
        });
        this.music.actions.updateQueueMessageWithInteraction(interaction);
    }

    get button(): MessageButton {
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'actionRow', 'skip']),
            )
            .setDisabled(this.music.queue?.size === 0 || this.music.paused)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }
}
