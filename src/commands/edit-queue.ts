import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue, QueueOption } from '../entities';
import { AbstractCommand } from '../models';

export class EditQueue extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string {
        return this.translate(['music', 'commands', 'edit', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'edit', 'label']))
            .setDisabled(false)
            .setStyle(
                queue.hasOption(QueueOption.Options.EDITING)
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user) return;
        let queue: Queue | undefined = await this.getQueue();
        if (!queue) return;

        if (queue.hasOption(QueueOption.Options.EDITING))
            queue = await queue.removeOptions([QueueOption.Options.EDITING]);
        else queue = await queue.addOption(QueueOption.Options.EDITING);

        this.client.musicActions.updateQueueMessage({
            interaction: interaction,
            queue: queue,
            componentsOnly: true,
        });
    }
}
