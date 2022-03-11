import {
    ButtonInteraction,
    InteractionWebhook,
    MessageAttachment,
    MessageButton,
} from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import moment from 'moment';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { Notification } from '../entities/notification';
import { AbstractCommand } from '../models';

export class Stop extends AbstractCommand {
    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'stop', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'stop', 'label']))
            .setStyle(
                queue.options.includes('stopRequest')
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
        const queue: Queue | undefined = await this.getQueue();
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
            this.client.destroyMusic(this.guildId);
        } else {
            if (!queue.options.includes('stopRequest'))
                queue.options.push('stopRequest');
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
                        expires: moment(moment.now()).add(24, 'h').toDate(),
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
                                        this.client.handleError(
                                            e,
                                            'stop.ts -> webhook send',
                                        ),
                                    );
                            })
                            .catch((e) =>
                                this.client.handleError(
                                    e,
                                    'stop.ts -> notification save',
                                ),
                            );
                    });

                    const x: NodeJS.Timeout = setTimeout(async () => {
                        queue
                            .reload()
                            .then(() => {
                                queue.options = queue.options.filter(
                                    (o) => o !== 'stopRequest',
                                );
                                queue.save().then(() => {
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
