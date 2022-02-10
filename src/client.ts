import { DiscordAPIError, REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import {
    Client,
    ClientOptions,
    CommandInteraction,
    GuildMember,
    Interaction,
    Message,
    Role,
    TextChannel,
    ThreadChannel,
    VoiceChannel,
} from 'discord.js';
import { Music } from './music';
import { LanguageString, Translator, LanguageKeyPath } from './translation';

export class MusicClient extends Client {
    private guildMusics: { [guildId: string]: Music };
    private musicRoleName: string;
    private slashCommandQueue: CommandInteraction[];
    private translator: Translator;

    constructor(
        options: ClientOptions,
        musicRoleName: string,
        defaultLang: LanguageString,
    ) {
        super(options);
        this.musicRoleName = musicRoleName;
        this.guildMusics = {};
        this.slashCommandQueue = [];
        this.translator = new Translator(defaultLang);
    }

    get musics(): { [guildId: string]: Music } {
        return this.guildMusics;
    }

    public translate(guildId: string | null, keys: LanguageKeyPath): string {
        return this.translator.translate(guildId, keys);
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

        this.musics[guildId].connection?.destroy();
        Music.archiveMusicThread(this.musics[guildId].thread, this);
        delete this.musics[guildId];
    }

    public handleError(error: Error): void {
        try {
            /* if discordApiError, do not log errors when fetching already
             * deleted messages or missing permissions to delete threads...*/
            const discordError: DiscordAPIError = error as DiscordAPIError;
            if (
                ['10008', '50013', '10003'].includes(
                    discordError.code.toString(),
                )
            )
                return;
        } catch (e) {
            console.error(error);
            return;
        }
        console.error(error);
    }

    public handleThreadMessage(msg: Message): void {
        if (
            !(msg.channel instanceof ThreadChannel) ||
            msg.channel.ownerId != this.user?.id
        )
            return;
        console.log('Handle thread message:', msg.id);
    }

    private handleInteraction(interaction: Interaction): void {
        if (
            !interaction.isCommand() ||
            interaction.commandName !==
                this.translate(interaction.guildId, ['slashCommand', 'name'])
        )
            return;

        this.slashCommandQueue.push(interaction);
        if (this.slashCommandQueue.length === 1)
            this.handleSlashCommand(interaction);
    }

    private handleSlashCommand(interaction: CommandInteraction): void {
        if (
            interaction.guildId &&
            interaction.guild &&
            interaction.guild.me &&
            interaction.channel &&
            interaction.channel instanceof TextChannel &&
            interaction.member &&
            interaction.member instanceof GuildMember &&
            this.textChannelPermissions(
                interaction.guild.me,
                interaction.channel,
            )
        ) {
            console.log('Handle slash command:', interaction.id);

            if (this.musicExists(interaction.guildId)) {
                /* if musics exists notify user
                 * and send the link to the music thread */

                this.musics[interaction.guildId].thread
                    ?.fetchStarterMessage()
                    .then(async (msg) => {
                        return interaction.reply({
                            content:
                                this.translate(interaction.guildId, [
                                    'error',
                                    'activeThread',
                                ]) +
                                '\n' +
                                msg.url,
                            ephemeral: true,
                            fetchReply: true,
                        });
                    })
                    .catch((error) => {
                        this.handleError(error);
                    });
            } else {
                // if valid member start a new music object in the channel

                this.validMember(interaction).then((result) => {
                    if (!result) return;

                    console.log(
                        `Initializing queue msg in guild ${interaction.guildId}`,
                    );

                    Music.newMusic(this, interaction).then((music) => {
                        if (interaction.guildId && music)
                            this.guildMusics[interaction.guildId] = music;
                    });
                });
            }
        }
        this.slashCommandQueue.shift();
        if (this.slashCommandQueue.length > 0)
            this.handleSlashCommand(this.slashCommandQueue[0]);
    }

    /** Check if client has the required text channel permissions*/
    private textChannelPermissions(
        clientMember: GuildMember,
        channel: TextChannel,
    ): boolean {
        return (
            channel.permissionsFor(clientMember).has('SEND_MESSAGES') &&
            channel
                .permissionsFor(clientMember)
                .has('CREATE_PUBLIC_THREADS') &&
            channel.permissionsFor(clientMember).has('READ_MESSAGE_HISTORY')
        );
    }

    /** Check if client has the required voice permissions*/
    private voiceChannelPermissions(
        clientMember: GuildMember,
        channel: VoiceChannel,
    ): boolean {
        return (
            channel.permissionsFor(clientMember).has('CONNECT') &&
            channel.permissionsFor(clientMember).has('SPEAK') &&
            channel.permissionsFor(clientMember).has('USE_VAD')
        );
    }

    /** Check if there is already an active music object in the server */
    private musicExists(guildId: string): boolean {
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

    /** check if user has the required music role and
     * is in the same channel as client
     * or client is not in channel */
    private async validMember(
        interaction: CommandInteraction,
        music: Music | null = null,
    ): Promise<boolean> {
        if (
            !interaction.guild ||
            !interaction.guildId ||
            !interaction.guild.me ||
            !interaction.member ||
            !(interaction.member instanceof GuildMember)
        )
            return false;
        if (
            !interaction.member.roles.cache.find(
                (r: Role) => r.name === this.musicRoleName,
            )
        ) {
            await interaction.reply({
                content:
                    this.translate(interaction.guildId, [
                        'error',
                        'missingRole',
                    ]) + `\`${this.musicRoleName}\``,
                ephemeral: true,
            });
            return false;
        }
        if (!interaction.member.voice.channel) {
            await interaction.reply({
                content: this.translate(interaction.guildId, [
                    'error',
                    'voice',
                    'user',
                    'notConnected',
                ]),
                ephemeral: true,
            });
            return false;
        }
        if (!(interaction.member.voice.channel instanceof VoiceChannel)) {
            await interaction.reply({
                content: this.translate(interaction.guildId, [
                    'error',
                    'voice',
                    'invalid',
                ]),
                ephemeral: true,
            });
            return false;
        }
        if (
            !this.voiceChannelPermissions(
                interaction.guild.me,
                interaction.member.voice.channel,
            )
        ) {
            await interaction.reply({
                content: this.translate(interaction.guildId, [
                    'error',
                    'voice',
                    'client',
                    'noPermissions',
                ]),
                ephemeral: true,
            });
            return false;
        }
        if (!music) return true;
        // if music check if member in the same voice channel as client!
        return false;
    }

    /** Register the slash command in all of the servers that the client is member of.*/
    private async registerSlashCommands(token: string): Promise<void> {
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
    private async archiveOldThreads(): Promise<void> {
        console.log('Archiving old music threads...');

        for await (const i of this.guilds.cache) {
            i[1].channels.fetchActiveThreads().then(async (fetched) => {
                if (!fetched || !fetched.threads || fetched.threads.size === 0)
                    return;
                for await (const thread of fetched.threads)
                    if (this.user)
                        await Music.archiveMusicThread(thread[1], this);
            });
        }
    }

    /** Register a new music command that initializes the music in the server */
    private async registerSlashCommand(
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
        client.on('error', (error: Error) => {
            client.handleError(error);
        });

        client.on('ready', async () => {
            if (!client.user) return;

            console.log('------------------------------------');
            console.log(`  Logged in as user ${client.user.tag}`);
            console.log('------------------------------------');

            await client.registerSlashCommands(token);
            await client.archiveOldThreads();
            client.user.setActivity(
                '/' + client.translate(null, ['slashCommand', 'name']),
                {
                    type: 'PLAYING',
                },
            );

            console.log('Client ready!\n');
        });

        client.on('interactionCreate', (interaction) => {
            client.handleInteraction(interaction);
        });

        client.on('messageCreate', (message) => {
            if (message.channel instanceof ThreadChannel)
                client.handleThreadMessage(message);
        });

        client.on('messageDelete', (message) => {
            if (message.guildId && message.author?.id == client.user?.id)
                client.destroyMusic(message.guildId);
        });

        client.on('threadDelete', (thread) => {
            if (thread.guildId && thread.ownerId == client.user?.id)
                client.destroyMusic(thread.guildId);
        });

        client.on('guildCreate', (guild) => {
            client.registerSlashCommand(guild.id, token);
        });

        client.login(token);
    }
}
