import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import {
    Client,
    ClientOptions,
    CommandInteraction,
    GuildMember,
    Message,
    Role,
    TextChannel,
    ThreadChannel,
    VoiceChannel,
} from 'discord.js';
import { Music } from './music';

export class MusicClient extends Client {
    private guildMusics: { [guildId: string]: Music };
    private musicRoleName: string;
    private slashCommandQueue: CommandInteraction[];

    constructor(options: ClientOptions, musicRoleName: string) {
        super(options);
        this.musicRoleName = musicRoleName;
        this.guildMusics = {};
        this.slashCommandQueue = [];
    }

    get musics(): { [guildId: string]: Music } {
        return this.guildMusics;
    }

    get slashCommand(): { [key: string]: string } {
        return {
            name: 'music',
            description: 'Starts a new music thread.',
        };
    }

    public async handleThreadMessage(msg: Message): Promise<void> {
        if (!(msg.channel instanceof ThreadChannel)) return;
        console.log('Handle thread message:', msg.id);
    }

    private async handleSlashCommand(
        interaction: CommandInteraction,
    ): Promise<void> {
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
                await interaction.reply({
                    content: 'Music thread is already active in this server!!',
                    ephemeral: true,
                });
            } else {
                if (await this.validMember(interaction)) {
                    console.log(
                        `Initializing queue msg in guild ${interaction.guildId}`,
                    );
                    Music.newMusic(this, interaction).then((music) => {
                        if (interaction.guildId && music)
                            this.guildMusics[interaction.guildId] = music;
                    });
                }
            }
        }
        this.slashCommandQueue.shift();
        if (this.slashCommandQueue.length > 0)
            this.handleSlashCommand(this.slashCommandQueue[0]);
    }

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

    private musicExists(guildId: string): boolean {
        if (guildId in this.guildMusics) {
            if (!this.guildMusics[guildId]) {
                delete this.guildMusics[guildId];
                return false;
            }
            return true;
        }
        return false;
    }

    private async validMember(
        interaction: CommandInteraction,
        music: Music | null = null,
    ): Promise<boolean> {
        /* check if user has the required role
        check if user is in the same channel as client,
        or client is not in channel */
        if (
            !interaction.guild ||
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
                content: `You are missing role \`${this.musicRoleName}\``,
                ephemeral: true,
            });
            return false;
        }
        if (!interaction.member.voice.channel) {
            await interaction.reply({
                content: 'You are not in a voice channel!',
                ephemeral: true,
            });
            return false;
        }
        if (!(interaction.member.voice.channel instanceof VoiceChannel)) {
            await interaction.reply({
                content: 'Invalid voice channel!',
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
                content:
                    'I am missing the required permissions to join the channel!',
                ephemeral: true,
            });
            return false;
        }
        if (!music) return true;
        // if music check if member in the same voice channel as client!
        return false;
    }

    private async registerSlashCommands(token: string): Promise<void> {
        if (!this.user) return;
        for (const guild of this.guilds.cache) {
            console.log(
                `Updating slash commands for guild "${guild[1].name}"`,
            );
            try {
                this.registerSlashCommand(guild[1].id, token);
            } catch (error) {
                console.log(
                    `Failed registering the clash command for "${guild[1].name}"`,
                );
            }
        }
    }

    private async archiveOldThreads(): Promise<void> {
        console.log('Archiving old music threads.');
        for (let i of this.guilds.cache) {
            i[1].channels.fetchActiveThreads().then(async (fetched) => {
                if (!fetched || !fetched.threads || fetched.threads.size == 0)
                    return;
                for (let thread of fetched.threads)
                    if (this.user)
                        await Music.archiveMusicThread(thread[1], this.user?.id);
            });
        }
    }

    private async registerSlashCommand(
        guildId: string,
        token: string,
    ): Promise<void> {
        const commands = [this.slashCommand];
        const rest = new REST({ version: '9' }).setToken(token);
        (async () => {
            if (!this.user) return;
            try {
                console.log('Started refreshing application (/) commands.');

                await rest.put(
                    Routes.applicationGuildCommands(this.user.id, guildId),
                    { body: commands },
                );

                console.log('Successfully reloaded application (/) commands.');
            } catch (error) {
                console.error(error);
            }
        })();
    }

    public static async run(
        client: MusicClient,
        token: string,
    ): Promise<void> {
        client.on('ready', async () => {
            if (!client.user) return;
            console.log('------------------------------------');
            console.log(`  Logged in as user ${client.user.tag}`);
            console.log('------------------------------------');
            client.registerSlashCommands(token).then(() => {});
            await client.archiveOldThreads();
        });

        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isCommand()) return;

            if (interaction.commandName === client.slashCommand.name) {
                client.slashCommandQueue.push(interaction);
                if (client.slashCommandQueue.length == 1)
                    await client.handleSlashCommand(interaction);
            }
        });

        client.on('guildCreate', (guild) => {
            client.registerSlashCommand(guild.id, token);
        });

        client.login(token);
    }
}
