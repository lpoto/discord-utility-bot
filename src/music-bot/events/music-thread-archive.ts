import { ThreadChannel } from 'discord.js';
import { MusicClient } from '../client';
import { AbstractMusicEvent } from '../utils/abstract-music-event';

export class OnMusicThreadArchive extends AbstractMusicEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(thread: ThreadChannel): Promise<void> {
        if (
            !thread ||
            !this.client.user ||
            !thread.guild ||
            !thread.guildId ||
            !thread.parentId ||
            thread.ownerId !== this.client.user?.id
        )
            return;
        thread
            .setName(
                this.client.translate(['music', 'thread', 'archivedName']),
            )
            .then(() => {
                thread
                    .setArchived()
                    .then(() => {
                        this.client.logger.debug(
                            `Archived thread: '${thread.id}' in guild '${thread.guildId}'`,
                        );
                        thread
                            .fetchStarterMessage()
                            .then((message) => {
                                message.delete().catch((e) => {
                                    this.client.emitEvent('error', e);
                                });
                            })
                            .catch((e) => {
                                this.client.emitEvent('error', e);
                            });
                    })
                    .catch((e: Error) => {
                        this.client.logger.warn(
                            'Could not archive the thread:',
                            e.message,
                        );
                    })
                    .then(() => {
                        thread
                            .delete()
                            .then(() => {
                                this.client.logger.debug(
                                    `Deleted thread: '${thread.id}'`,
                                );
                            })
                            .catch((error) => {
                                this.client.emitEvent('error', error);
                            });
                    })
                    .catch((e: Error) => {
                        this.client.logger.warn(
                            'Could not delete the thread:',
                            e.message,
                        );
                    });
            });
    }
}

export namespace OnMusicThreadArchive {
    export type Type = [
        'musicThreadArchive',
        ...Parameters<OnMusicThreadArchive['callback']>,
    ];
}
