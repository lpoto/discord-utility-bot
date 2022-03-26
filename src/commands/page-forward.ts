import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractCommand } from '../utils';

export class PageForward extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get interactionTimeout(): number {
        return 100;
    }

    public get description(): string {
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
            .setDisabled(Queue.songsPerPage >= queue.size - 1)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user) return;

        const queue: Queue | undefined = await this.getQueue();
        if (!queue || queue.size - 1 <= Queue.songsPerPage) return;

        queue.offset += Queue.songsPerPage;
        if (queue.offset >= queue.size - 1) queue.offset = 0;

        queue.save().then(async (q) => {
            this.updateQueue({
                queue: q,
                interaction: interaction,
                embedOnly: true,
            });
        });
    }
}
