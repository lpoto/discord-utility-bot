import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { QueueOption } from '../entities/option';
import { AbstractCommand } from '../models';

export class Expand extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string {
        return this.translate(['music', 'commands', 'expand', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection || !queue.hasOption(QueueOption.Options.EDITING))
            return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'expand', 'label']))
            .setDisabled(queue.size < 2)
            .setStyle(
                queue.hasOption(QueueOption.Options.EXPANDED)
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user) return;
        let queue: Queue | undefined = await this.getQueue();
        if (!queue) return;

        if (queue.hasOption(QueueOption.Options.EXPANDED))
            queue = await queue.removeOptions([QueueOption.Options.EXPANDED]);
        else queue = await queue.addOption(QueueOption.Options.EXPANDED);

        this.client.musicActions.updateQueueMessage({
            interaction: interaction,
            queue: queue,
        });
    }
}
