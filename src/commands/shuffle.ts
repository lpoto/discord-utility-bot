import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { Not, SelectQueryBuilder } from 'typeorm';
import { MusicClient } from '../client';
import { Queue, Song, QueueOption } from '../entities';
import { AbstractCommand } from '../utils';

export class Shuffle extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string {
        return this.translate(['music', 'commands', 'shuffle', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection || !queue.hasOption(QueueOption.Options.EDITING))
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
                    .catch((e) => this.client.emit('error', e));
            return;
        }

        // create custom queries for shuffling song positiongs

        const q1: string = this.queryToString(
            Song.createQueryBuilder('song')
                .select(
                    'row_number() OVER (ORDER BY RANDOM()) rn, ' +
                        'position AS new_position',
                )
                .where({ queue: queue, id: Not(queue.headSong.id) }),
        );

        const q2 = this.queryToString(
            Song.createQueryBuilder('song')
                .select(
                    'row_number() OVER (ORDER BY RANDOM()) rn,' +
                        ' id AS ref_id',
                )
                .where({ queue: queue, id: Not(queue.headSong.id) }),
        );

        Song.query(
            `WITH positions AS (${q1}), ids AS (${q2}) ` +
                'UPDATE song SET position = new_position ' +
                'FROM positions JOIN ids ' +
                'ON positions.rn = ids.rn WHERE id = ref_id',
        ).then(() => {
            this.client.musicActions.updateQueueMessage({
                interaction: interaction,
                queue: queue,
                reload: true,
            });
        });
    }

    private queryToString(q: SelectQueryBuilder<Song>): string {
        let qString: string = q.getQuery();
        for (const i of Object.keys(q.getParameters())) {
            qString = qString.replace(`:${i}`, `'${q.getParameters()[i]}'`);
        }
        return qString;
    }
}
