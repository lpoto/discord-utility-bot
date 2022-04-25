import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue, QueueOption } from '../entities';
import { AbstractCommand } from '../utils';

export class PageBackward extends AbstractCommand {
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
            .setDisabled(Queue.songsPerPage >= queue.size - 1)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user) return;

        const queue: Queue | undefined = await this.getQueue();
        if (!queue || queue.size - 1 <= Queue.songsPerPage) return;

        queue.offset -= Queue.songsPerPage;
        if (queue.offset < 0) {
            const y: number =
                queue.size % Queue.songsPerPage === 0
                    ? queue.size - 1
                    : queue.size;
            const x: number = Math.round(y / Queue.songsPerPage);
            queue.offset = x * Queue.songsPerPage;
        }
        queue.save().then((q) => {
            this.updateQueue({
                interaction: interaction,
                queue: q,
                embedOnly: !queue.hasOption(QueueOption.Options.EDITING),
            });
        });
    }
}
