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
            .setDisabled(queue.songs.length < 3)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user) return;
        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        if (queue.songs.length < 3) {
            try {
                if (!interaction.deferred && !interaction.replied)
                    interaction.deferUpdate();
            } catch (e) {
                return;
            }
            return;
        }

        const items: { [key: string]: string | number }[] = queue.songs
            .slice(1)
            .map((s) => {
                return {
                    name: s.name,
                    url: s.url,
                    durationSeconds: s.durationSeconds,
                    durationString: s.durationString,
                };
            });

        for (let i: number = items.length - 1; i > 0; i--) {
            const randomIndex: number = Math.floor(Math.random() * i);
            [items[i], items[randomIndex]] = [items[randomIndex], items[i]];
        }

        queue.songs = [queue.songs[0]].concat(
            items.map((i) => {
                return Song.create({
                    queue: queue,
                    name: i.name.toString(),
                    durationString: i.durationString.toString(),
                    durationSeconds: Number(i.durationSeconds),
                    url: i.url.toString(),
                });
            }),
        );
        queue.save().then(() => {
            if (!queue) return;
            this.client.musicActions.updateQueueMessageWithInteraction(
                interaction,
                queue,
            );
        });
    }
}
