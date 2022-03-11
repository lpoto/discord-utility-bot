import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue, QueueOption } from '../entities';
import { AbstractCommand } from '../models';

export class LoopQueue extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string {
        return this.translate([
            'music',
            'commands',
            'loopQueue',
            'description',
        ]);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user) return;
        let queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        if (queue.hasOption(QueueOption.Options.LOOP_QUEUE)) {
            queue = await queue.removeOptions([
                QueueOption.Options.LOOP_QUEUE,
            ]);
        } else {
            queue = await queue.removeOptions([QueueOption.Options.LOOP]);
            queue = await queue.addOption(QueueOption.Options.LOOP_QUEUE);
        }
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
            .setDisabled(queue.size < 1)
            .setStyle(
                queue.hasOption(QueueOption.Options.LOOP_QUEUE)
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }
}
