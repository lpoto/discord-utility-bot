import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { Client, ThreadChannel } from 'discord.js';
import { MusicClientOptions } from '.';
import { Music } from '../music';
import { Translator, LanguageKeyPath } from '../translation';
import { ClientEventHandler } from './client-event-handler';
import { PermissionChecker } from './permission-checker';

export class MusicClient extends Client {
    private guildMusics: { [guildId: string]: Music };
    private translator: Translator;
    private permissionChecker: PermissionChecker;
    private eventsHandler: ClientEventHandler;

    constructor(options: MusicClientOptions) {
        super(options);
        this.guildMusics = {};
        this.translator = new Translator(options.defaultLanguage);
        this.eventsHandler = new ClientEventHandler(this);
        this.permissionChecker = new PermissionChecker(
            options.clientVoicePermissions,
            options.clientTextPermissions,
            options.requiredMemberRoles,
            this,
        );
    }

    get permsChecker() {
        return this.permissionChecker;
    }

    get musics(): { [guildId: string]: Music } {
        return this.guildMusics;
    }

    public translate(guildId: string | null, keys: LanguageKeyPath): string {
        return this.translator.translate(guildId, keys);
    }

    public handleError(error: Error): void {
        return this.eventsHandler.handleError(error);
    }

    public slashCommand(guildId: string): { [key: string]: string } {
        return {
            name: this.translate(guildId, ['slashCommand', 'name']),
            description: this.translate(guildId, [
                'slashCommand',
                'description',
            ]),
        };
    }

    public destroyMusic(guildId: string): void {
        if (!(guildId in this.musics) || !this.musics[guildId] || !this.user)
            return;
        console.log('Destroy music in guild: ', guildId);

        this.musics[guildId].actions.leaveVoice();
        this.archiveMusicThread(this.musics[guildId].thread, this);
        delete this.musics[guildId];
    }

    /** Check if there is already an active music object in the server */
    public musicExists(guildId: string): boolean {
        if (guildId in this.guildMusics) {
            if (
                !this.guildMusics[guildId] ||
                !this.guildMusics[guildId].thread
            ) {
                delete this.guildMusics[guildId];
                return false;
            }
            return true;
        }
        return false;
    }

    /** Register the slash command in all of the servers that the client is member of.*/
    public async registerSlashCommands(token: string): Promise<void> {
        if (!this.user) return;
        console.log('Started refreshing application (/) commands...');

        for (const guild of this.guilds.cache) {
            console.log(
                `Updating slash commands for guild "${guild[1].name}"`,
            );

            try {
                await this.registerSlashCommand(guild[1].id, token);
            } catch (error) {
                console.error(
                    `Failed registering the clash command for "${guild[1].name}"`,
                );
            }
        }
        console.log('Successfully reloaded application (/) commands.');
    }

    /** Archive old music threads that were not closed properly.*/
    public async archiveOldThreads(): Promise<void> {
        console.log('Archiving old music threads...');

        for await (const i of this.guilds.cache) {
            i[1].channels.fetchActiveThreads().then(async (fetched) => {
                if (!fetched || !fetched.threads || fetched.threads.size === 0)
                    return;
                for await (const thread of fetched.threads)
                    if (this.user)
                        await this.archiveMusicThread(thread[1], this);
            });
        }
    }

    /** Archive a music thread, delete it if possible and delete
     * the queue message */
    public async archiveMusicThread(
        thread: ThreadChannel | null,
        client: MusicClient,
    ): Promise<void> {
        if (
            !thread ||
            !thread.guild ||
            !thread.guildId ||
            !thread.parentId ||
            thread.ownerId !== client.user?.id
        )
            return;
        thread
            .fetchStarterMessage()
            .then(async (message) => {
                if (!message || !message.deletable) return;
                try {
                    await message.delete();
                } catch (error) {
                    return error;
                }
            })
            .catch((error) => {
                this.handleError(error);
            });
        thread
            .setName(
                this.translate(thread.guildId, [
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
                                this.handleError(error);
                            });
                    })
                    .catch(() => {
                        console.log('Could not delete the thread!');
                    });
            });
    }

    /** Register a new music command that initializes the music in the server */
    public async registerSlashCommand(
        guildId: string,
        token: string,
    ): Promise<void> {
        const commands = [this.slashCommand(guildId)];
        const rest = new REST({ version: '9' }).setToken(token);
        (async () => {
            if (!this.user) return;
            await rest.put(
                Routes.applicationGuildCommands(this.user.id, guildId),
                { body: commands },
            );
        })();
    }

    /** Subscribe to required client events for the music client and login */
    public static async run(
        client: MusicClient,
        token: string,
    ): Promise<void> {
        await client.eventsHandler.subscribe(token);
        client.login(token);
    }
}
