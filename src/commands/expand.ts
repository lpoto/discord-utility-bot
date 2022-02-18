import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractCommand } from '../models';

export class Expand extends AbstractCommand {
    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'expand', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection || !queue.options.includes('editing'))
            return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'expand', 'label']))
            .setDisabled(queue.songs.length < 2)
            .setStyle(
                queue.options.includes('expanded')
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user) return;
        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        if (queue.options.includes('expanded')) {
            queue.options = queue.options.filter((o) => o !== 'expanded');
        } else {
            queue.options.push('expanded');
        }

        await queue.save();
        this.client.musicActions.updateQueueMessageWithInteraction(
            interaction,
            queue,
        );
    }
}
