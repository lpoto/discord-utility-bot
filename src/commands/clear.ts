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

    public get interactionTimeout(): number {
        return 300;
    }

    public get description(): string {
        return this.translate(['music', 'commands', 'clear', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (
            !this.connection ||
            !queue.hasOption(QueueOption.Options.EDITING) ||
            queue.hasDropdownOption()
        )
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
            !this.client.user ||
            !interaction ||
            interaction.deferred ||
            interaction.replied ||
            !interaction.component ||
            !interaction.user
        )
            return;
        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;

        if (queue.hasOption(QueueOption.Options.CLEAR_SELECTED)) {
            return this.clearSelectedClick(queue, interaction);
        }

        this.notClearSelectedClick(queue, interaction);
    }

    private async notClearSelectedClick(
        queue: Queue,
        interaction: ButtonInteraction,
    ): Promise<void> {
        if (!this.client.user) return;
        queue = await queue.addOption(QueueOption.Options.CLEAR_SELECTED);
        queue = await queue.save();

        const webhook: InteractionWebhook = interaction.webhook;
        this.updateQueue({
            queue: queue,
            interaction: interaction,
        });
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
                        this.client.emitEvent('error', e);
                    });
            });
        });

        const x: NodeJS.Timeout = setTimeout(() => {
            if (!queue) return;
            queue
                .reload()
                .then(async () => {
                    if (!queue) return;
                    queue = queue.removeOptions([
                        QueueOption.Options.CLEAR_SELECTED,
                    ]);
                    queue = await queue.save();
                    this.client.emitEvent('queueMessageUpdate', {
                        queue: queue,
                    });
                })
                .catch(() => {});
        }, 5000);
        x.unref();
    }

    private async clearSelectedClick(
        queue: Queue,
        interaction: ButtonInteraction,
    ): Promise<void> {
        queue.offset = 0;
        queue = await queue.save();
        if (queue.size > 0) {
            queue.getAllSongs().then((songs) => {
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

        queue = queue.removeOptions([
            QueueOption.Options.CLEAR_SELECTED,
            QueueOption.Options.REMOVE_SELECTED,
            QueueOption.Options.FORWARD_SELECTED,
            QueueOption.Options.TRANSLATE_SELECTED,
        ]);

        queue = await queue.save();

        // remove all songs but the head song
        await Song.createQueryBuilder('song')
            .where({ id: Not(queue.headSong?.id) })
            .delete()
            .execute();

        this.client.emitEvent('queueMessageUpdate', {
            interaction: interaction,
            queue: queue,
        });
    }
}
