import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { CommandName, MusicCommandOptions } from '.';
import { Command, Song } from '../models';

export class Skip extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'skip', 'description']);
    }

    get button(): MessageButton {
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'skip', 'label']))
            .setDisabled(this.music.queue?.size === 0 || this.music.paused)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
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
        this.music.resetTimer();
        this.music.commands.execute({
            name: CommandName.PLAY,
        });
        this.music.actions.updateQueueMessageWithInteraction(interaction);
    }
}
