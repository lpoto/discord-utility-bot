import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractCommand, QueueEmbed } from '../models';

export class PageForward extends AbstractCommand {
    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    get description(): string {
        return this.translate([
            'music',
            'commands',
            'pageForward',
            'description',
        ]);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'pageForward', 'label']),
            )
            .setDisabled(
                queue.offset + QueueEmbed.songsPerPage() >=
                    queue.songs.length - 1,
            )
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user) return;

        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;

        queue.offset += QueueEmbed.songsPerPage();
        queue.save().then((q) => {
            this.client.musicActions.updateQueueMessage({
                interaction: interaction,
                queue: q,
            });
        });
    }
}
