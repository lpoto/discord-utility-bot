import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { Message, TextChannel, ThreadChannel } from 'discord.js';
import { MusicClient } from './client';
import { Queue } from './entities';

export class UtilityActions {
    private client: MusicClient;
    private token: string;

    public constructor(client: MusicClient, token: string) {
        this.client = client;
        this.token = token;
    }

    /** Register the slash command in all of the servers that the client is member of.*/
    public async registerSlashCommands(): Promise<void> {
        if (!this.client.user) return;
        console.log('Refreshing application (/) commands.');

        for await (const guild of this.client.guilds.cache) {
            try {
                await this.registerSlashCommand(guild[1].id);
                console.log(
                    `Successfully registered slash commands for guild "${guild[1].name}".`,
                );
            } catch (error) {
                console.error(
                    `Failed registering slash commands for guild "${guild[1].name}".`,
                );
            }
        }
    }

    /** Register a new music command that initializes the music in the server */
    public async registerSlashCommand(guildId: string): Promise<void> {
        const commands = [this.slashCommand(guildId)];
        const rest = new REST({ version: '9' }).setToken(this.token);
        (async () => {
            if (!this.client.user) return;
            await rest.put(
                Routes.applicationGuildCommands(this.client.user.id, guildId),
                { body: commands },
            );
        })();
    }

    public async checkThreadAndMessage(
        queue: Queue,
        update?: boolean,
    ): Promise<Message | null> {
        return this.client.channels
            .fetch(queue.channelId)
            .then((channel) => {
                if (!channel || !(channel instanceof TextChannel)) return null;
                return channel.threads
                    .fetch(queue.threadId)
                    .then((thread) => {
                        return channel.messages
                            .fetch(queue.messageId)
                            .then((message) => {
                                if (!message && thread) {
                                    this.archiveMusicThread(thread);
                                    return null;
                                }
                                if (!thread && message) {
                                    message
                                        .delete()
                                        .catch((error) =>
                                            this.client.emit('error', error),
                                        );
                                    return null;
                                }
                                if (update)
                                    this.client.musicActions.updateQueueMessage(
                                        {
                                            queue: queue,
                                            clientRestart: true,
                                        },
                                    );
                                return message;
                            })
                            .catch((e) => {
                                this.client.emit('error', e);
                                this.archiveMusicThread(thread);
                                return null;
                            });
                    })
                    .catch((error) => {
                        this.client.emit('error', error);
                        return null;
                    });
            })
            .catch((e) => {
                this.client.emit('error', e);
                return null;
            });
    }

    /** Archive a music thread, delete it if possible and delete
     * the queue message */
    public async archiveMusicThread(
        thread: ThreadChannel | null,
    ): Promise<void> {
        if (
            !thread ||
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

    private slashCommand(guildId: string): { [key: string]: string } {
        return {
            name: this.client.translate(null, ['slashCommand', 'name']),
            description: this.client.translate(guildId, [
                'slashCommand',
                'description',
            ]),
        };
    }
}
