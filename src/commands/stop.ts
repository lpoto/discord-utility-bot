import {
    ButtonInteraction,
    InteractionWebhook,
    MessageAttachment,
    MessageButton,
} from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue, Notification, QueueOption } from '../entities';
import { AbstractCommand } from '../utils';

export class Stop extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string {
        return this.translate(['music', 'commands', 'stop', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'stop', 'label']))
            .setStyle(
                queue.hasOption(QueueOption.Options.STOP_SELECTED)
                    ? MessageButtonStyles.PRIMARY
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            !interaction.component ||
            !interaction.user ||
            interaction.deferred ||
            interaction.replied
        )
            return;
        let queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        if (interaction.component.style === 'PRIMARY') {
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
                            'stop',
                            'reply',
                        ]),
                        files: [attachment],
                    });
                });
            }
            this.client.musicActions.destroyMusic(this.guildId);
        } else {
            if (!queue.hasOption(QueueOption.Options.STOP_SELECTED))
                queue = await queue.addOption(
                    QueueOption.Options.STOP_SELECTED,
                );
            await queue.save();

            const webhook: InteractionWebhook = interaction.webhook;
            this.client.musicActions
                .updateQueueMessage({
                    interaction: interaction,
                    queue: queue,
                    componentsOnly: true,
                })
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
                        notification
                            .save()
                            .then(() => {
                                webhook
                                    .send({
                                        content: this.translate([
                                            'music',
                                            'commands',
                                            'stop',
                                            'confirm',
                                        ]),
                                        ephemeral: true,
                                    })
                                    .catch((e) =>
                                        this.client.emit('error', e),
                                    );
                            })
                            .catch((e) => this.client.emit('error', e));
                    });

                    const x: NodeJS.Timeout = setTimeout(async () => {
                        if (!queue) return;
                        queue
                            .reload()
                            .then(async () => {
                                if (!queue) return;
                                queue = await queue.removeOptions([
                                    QueueOption.Options.STOP_SELECTED,
                                ]);
                                queue.save().then(() => {
                                    if (!queue) return;
                                    this.client.musicActions.updateQueueMessage(
                                        {
                                            queue: queue,
                                            componentsOnly: true,
                                        },
                                    );
                                });
                            })
                            .catch(() => {});
                    }, 5000);
                    x.unref();
                });
        }
    }
}
