import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
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
            .setDisabled(queue.songs.length < 3)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user) return;
        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        if (queue.songs.length < 3) {
            if (!interaction.deferred && !interaction.replied)
                interaction
                    .deferUpdate()
                    .catch((e) => this.client.handleError(e));
            return;
        }

        const arr: number[] = Array.from(Array(queue.songs.length).keys());
        arr.shift();
        let minPos: number = Math.min.apply(
            null,
            queue.songs.map((s) => s.position),
        );
        for await (const song of queue.songs) {
            if (song.position === minPos) {
                song.position = 0;
                minPos = 0;
            } else {
                const randomIndex: number = Math.floor(
                    Math.random() * arr.length,
                );
                song.position = arr[randomIndex];
                arr.splice(randomIndex, 1);
            }
            await song.save();
        }

        this.client.musicActions.updateQueueMessage({
            interaction: interaction,
            queue: queue,
            embedOnly: true,
            reload: true,
        });
    }
}
