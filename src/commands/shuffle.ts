import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
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
        if (queue.size < 3) {
            if (!interaction.deferred && !interaction.replied)
                interaction
                    .deferUpdate()
                    .catch((e) => this.client.handleError(e));
            return;
        }

        const x: Song[] = await queue.allSongs;
        const max: number = x.length - 1;
        const min = 1;
        queue.allSongs.then((songs) => {
            songs.map(async (s) => {
                if (queue && s.id === queue.headSong?.id) s.position = 0;
                else
                    s.position = Math.floor(
                        Math.random() * (max - min + 1) + min,
                    );
                await s.save();
            });

            this.client.musicActions.updateQueueMessage({
                interaction: interaction,
                queue: queue,
                reload: true,
            });
        });
    }
}
