import { ThreadChannel } from 'discord.js';
import { MusicClient } from '../client';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnMusicThreadArchive extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
        this.name = 'musicThreadArchive';
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
                this.client.translate(thread.guildId, [
                    'music',
                    'thread',
                    'archivedName',
                ]),
            )
            .then(() => {
                thread
                    .setArchived()
                    .then(() => {
                        console.log(`Archived thread: ${thread.id}`);
                        thread
                            .fetchStarterMessage()
                            .then((message) => {
                                message.delete().catch((e) => {
                                    this.client.emit('error', e);
                                });
                            })
                            .catch((e) => {
                                this.client.emit('error', e);
                            });
                    })
                    .catch(() => {
                        console.log('Could not archive the thread!');
                    })
                    .then(() => {
                        thread
                            .delete()
                            .then(() => {
                                console.log(`Deleted thread: ${thread.id}`);
                            })
                            .catch((error) => {
                                this.client.emit('error', error);
                            });
                    })
                    .catch(() => {
                        console.log('Could not delete the thread!');
                    });
            });
    }
}
