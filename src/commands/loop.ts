import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue, QueueOption } from '../entities';
import { AbstractCommand } from '../utils';

export class Loop extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string {
        return this.translate(['music', 'commands', 'loop', 'description']);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user) return;
        let queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        if (queue.hasOption(QueueOption.Options.LOOP)) {
            queue = await queue.removeOptions([QueueOption.Options.LOOP]);
        } else {
            queue = await queue.removeOptions([
                QueueOption.Options.LOOP_QUEUE,
            ]);
            queue = await queue.addOption(QueueOption.Options.LOOP);
        }
        await queue.save();
        this.client.emitEvent('queueMessageUpdate', {
            interaction: interaction,
            queue: queue,
        });
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'loop', 'label']))
            .setDisabled(queue.size < 1)
            .setStyle(
                queue.hasOption(QueueOption.Options.LOOP)
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }
}
