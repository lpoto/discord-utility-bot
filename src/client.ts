import { REST } from '@discordjs/rest';
import {
    APIInteraction,
    APIInteractionGuildMember,
    Routes,
} from 'discord-api-types/v9';
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
    User,
    VoiceChannel,
} from 'discord.js';
import { Music } from './music';

export class MusicClient extends Client {
    private guildMusics: { [guildId: string]: Music };
    private musicRoleName: string;

    constructor(options: ClientOptions, musicRoleName: string) {
        super(options);
        this.musicRoleName = musicRoleName;
        this.guildMusics = {};
    }

    get slashCommand(): { [key: string]: string } {
        return {
            name: 'music',
            description: 'Starts a new music thread.',
        };
    }

    public async handleThreadMessage(msg: Message): Promise<void> {
        if (!(msg.channel instanceof ThreadChannel)) return;
        console.log('Handle thread message:', msg);
    }

    private async handleSlashCommand(
        interaction: CommandInteraction,
    ): Promise<void> {
        if (!interaction.guildId) return;
        console.log('Handle slash command:', interaction.id);
        if (this.musicExists(interaction.guildId)) {
            await interaction.reply({
                content: 'Music thread is already active in this server!!',
                ephemeral: true,
            });
            return;
        }
        if (!(await this.validMember(interaction))) return;
        console.log(`Initializing queue msg in guild ${interaction.guildId}`);
        const music: Music | null = await Music.newMusic(this, interaction);
        if (music) this.guildMusics[interaction.guildId] = music;
    }

    private musicExists(guildId: string): boolean {
        if (guildId in this.guildMusics) {
            if (
                !this.guildMusics[guildId] ||
                !this.guildMusics[guildId].ready
            ) {
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
        client.on('ready', () => {
            if (!client.user) return;
            console.log('------------------------------------');
            console.log(`  Logged in as user ${client.user.tag}`);
            console.log('------------------------------------');
            client.registerSlashCommands(token).then(() => {});
        });

        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isCommand()) return;

            if (interaction.commandName === client.slashCommand.name) {
                await client.handleSlashCommand(interaction);
            }
        });
        client.login(token);
    }
}
