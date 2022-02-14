import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from '../models';

export class Clear extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'clear', 'description']);
    }

    get button(): MessageButton | null {
        if (!this.music.editing) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'clear', 'label']))
            .setDisabled(!this.music.queue || this.music.queue?.size < 2)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            !interaction.user ||
            !this.music.thread ||
            !this.music.queue
        )
            return;
        const songs: string =
            '`' +
            this.music.queue.allSongs.map((s) => s.name).join('\n') +
            '`';
        this.music.queue.clear().then(() => {
            this.music.actions
                .updateQueueMessageWithInteraction(interaction)
                .then(() => {
                    interaction.user.send({
                        content:
                            this.translate([
                                'music',
                                'commands',
                                'clear',
                                'clearedSongs',
                            ]) + songs,
                    });
                });
        });
    }
}
