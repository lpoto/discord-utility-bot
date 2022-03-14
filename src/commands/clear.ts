import {
    ButtonInteraction,
    InteractionWebhook,
    MessageAttachment,
    MessageButton,
} from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { Not } from 'typeorm';
import { MusicClient } from '../client';
import { Queue, Song, QueueOption, Notification } from '../entities';
import { AbstractCommand } from '../utils';

export class Clear extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string {
        return this.translate(['music', 'commands', 'clear', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection || !queue.hasOption(QueueOption.Options.EDITING))
            return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'clear', 'label']))
            .setDisabled(queue.size < 2)
            .setStyle(
                queue.hasOption(QueueOption.Options.CLEAR_SELECTED)
                    ? MessageButtonStyles.PRIMARY
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            interaction.deferred ||
            interaction.replied ||
            !interaction.component ||
            !interaction.user
        )
            return;
        let queue: Queue | undefined = await this.getQueue();
        if (!queue) return;

        if (interaction.component.style === 'PRIMARY') {
            queue.offset = 0;
            queue = await queue.save();
            if (queue.size > 0) {
                queue.allSongs.then((songs) => {
                    if (!songs) return;
                    const attachment = new MessageAttachment(
                        Buffer.from(
                            songs
                                .map(
                                    (s) =>
                                        `{ name: \`${s.name}\`, url: \`${s.url}\` }`,
                                )
                                .join('\n'),
                            'utf-8',
                        ),
                        'removed-songs.txt',
                    );
                    interaction.user.send({
                        content: this.translate([
                            'music',
                            'commands',
                            'clear',
                            'reply',
                        ]),
                        files: [attachment],
                    });
                });
            }

            queue = await queue.removeOptions([
                QueueOption.Options.CLEAR_SELECTED,
                QueueOption.Options.REMOVE_SELECTED,
                QueueOption.Options.FORWARD_SELECTED,
                QueueOption.Options.TRANSLATE_SELECTED,
            ]);

            // remove all songs but the head song
            await Song.createQueryBuilder('song')
                .where({ id: Not(queue.headSong?.id) })
                .delete()
                .execute();

            this.client.musicActions.updateQueueMessage({
                interaction: interaction,
                queue: queue,
                reload: true,
            });
        } else {
            if (!queue.hasOption(QueueOption.Options.CLEAR_SELECTED))
                queue = await queue.addOption(
                    QueueOption.Options.CLEAR_SELECTED,
                );
            await queue.save();

            const webhook: InteractionWebhook = interaction.webhook;
            this.client.musicActions
                .updateQueueMessage({ interaction: interaction, queue: queue })
                .then((result) => {
                    if (!result || !this.client.user) return;
                    const notification: Notification = Notification.create({
                        userId: interaction.user.id,
                        clientId: this.client.user.id,
                        guildId: this.guildId,
                        minutesToPersist: 24 * 60,
                        name: 'clearStopRequest',
                    });
                    Notification.findOne({
                        userId: notification.userId,
                        clientId: notification.clientId,
                        guildId: notification.guildId,
                        name: notification.name,
                    }).then((n) => {
                        if (n) return;
                        notification.save().then(() => {
                            webhook
                                .send({
                                    content: this.translate([
                                        'music',
                                        'commands',
                                        'clear',
                                        'confirm',
                                    ]),
                                    ephemeral: true,
                                })
                                .catch((e) => {
                                    this.client.emit('error', e);
                                });
                        });
                    });

                    const x: NodeJS.Timeout = setTimeout(() => {
                        if (!queue) return;
                        queue
                            .reload()
                            .then(async () => {
                                if (!queue) return;
                                if (
                                    !queue.hasOption(
                                        QueueOption.Options.EDITING,
                                    )
                                )
                                    return;
                                queue = await queue.removeOptions([
                                    QueueOption.Options.CLEAR_SELECTED,
                                ]);
                                this.client.musicActions.updateQueueMessage({
                                    queue: queue,
                                    componentsOnly: true,
                                });
                            })
                            .catch(() => {});
                    }, 5000);
                    x.unref();
                });
        }
    }
}
