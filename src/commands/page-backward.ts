import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractCommand } from '../utils';

export class PageBackward extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string {
        return this.translate([
            'music',
            'commands',
            'pageBackward',
            'description',
        ]);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'pageBackward', 'label']),
            )
            .setDisabled(queue.offset === 0)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user) return;

        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;

        queue.offset -= Queue.songsPerPage;
        if (queue.offset < 0) queue.offset = 0;
        queue.save().then((q) => {
            this.client.emit('queueMessageUpdate', {
                interaction: interaction,
                queue: q,
                reload: true,
            });
        });
    }
}
