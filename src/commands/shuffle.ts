import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { Not } from 'typeorm';
import { MusicClient } from '../client';
import { Queue, Song } from '../entities';
import { AbstractCommand } from '../models';

export class Shuffle extends AbstractCommand {
    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'shuffle', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection || !queue.options.includes('editing'))
            return null;
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'shuffle', 'label']),
            )
            .setDisabled(queue.size < 3)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user) return;
        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        if (queue.size < 3 || !queue.headSong) {
            if (!interaction.deferred && !interaction.replied)
                interaction
                    .deferUpdate()
                    .catch((e) => this.client.handleError(e));
            return;
        }

        // set headSong's position to 0
        queue.headSong.position = 0;
        await queue.headSong.save();

        // set other songs positions random between 1 and songCount
        const max: number = queue.size + 1;
        const min = 1;

        Song.createQueryBuilder('song')
            .update()
            .where({ id: Not(queue.headSong.id), queue: queue })
            .set({
                position: () => `floor(random() * ${max} + ${min})`,
            })
            .execute()
            .then(() => {
                this.client.musicActions.updateQueueMessage({
                    interaction: interaction,
                    queue: queue,
                    reload: true,
                });
            });
    }
}
