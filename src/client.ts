import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import {
    Client,
    ClientOptions,
    Interaction,
    Message,
    ThreadChannel,
    User,
} from 'discord.js';
import { Music } from './music';

export class MusicClient extends Client {
    private guildMusics: { [guildId: string]: Music };
    private musicRoleName: string;
    private clientReady: boolean;

    constructor(options: ClientOptions, musicRoleName: string) {
        super(options);
        this.musicRoleName = musicRoleName;
        this.guildMusics = {};
        this.clientReady = false;
    }

    public async handleThreadMessage(msg: Message): Promise<void> {
        if (!(msg.channel instanceof ThreadChannel)) return;
        console.log('Handle thread message:', msg);
    }

    public async handleInteractions(interaction: Interaction): Promise<void> {
        console.log('Handle interaction:', interaction);
    }

    private async checkUser(user: User, music: Music): Promise<boolean> {
        // check if user has the required role
        /* check if user is in the same channel as client,
        or client is not in channel*/
        if (!music.ready || !music.guild) return false;
        return music.guild.members.fetch(user.id).then((member) => {
            if (!member || !member.roles.cache.has(this.musicRoleName))
                return false;
            return true;
        });
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
        const commands = [
            {
                name: 'music',
                description: 'Starts a new music thread.',
            },
        ];
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

        client.login(token);
    }
}
