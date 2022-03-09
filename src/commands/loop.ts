import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractCommand } from '../models';

export class Loop extends AbstractCommand {
    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'loop', 'description']);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user) return;
        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        if (queue.options.includes('loop')) {
            queue.options = queue.options.filter((o) => o !== 'loop');
        } else {
            queue.options = queue.options.filter((o) => o !== 'loopQueue');
            queue.options.push('loop');
        }
        await queue.save();
        this.client.musicActions.updateQueueMessage({
            interaction: interaction,
            queue: queue,
            componentsOnly: true,
        });
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'loop', 'label']))
            .setDisabled(queue.size < 1)
            .setStyle(
                queue.options.includes('loop')
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }
}
