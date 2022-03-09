import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractCommand } from '../models';

export class LoopQueue extends AbstractCommand {
    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    get description(): string {
        return this.translate([
            'music',
            'commands',
            'loopQueue',
            'description',
        ]);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user) return;
        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        if (queue.options.includes('loopQueue')) {
            queue.options = queue.options.filter((o) => o !== 'loopQueue');
        } else {
            queue.options = queue.options.filter((o) => o !== 'loop');
            queue.options.push('loopQueue');
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
            .setLabel(
                this.translate(['music', 'commands', 'loopQueue', 'label']),
            )
            .setDisabled(queue.songs.length < 1)
            .setStyle(
                queue.options.includes('loopQueue')
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }
}
