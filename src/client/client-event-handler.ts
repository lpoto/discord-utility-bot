import {
    ButtonInteraction,
    CommandInteraction,
    DiscordAPIError,
    GuildMember,
    Interaction,
    Message,
    MessageButton,
    TextChannel,
    ThreadChannel,
} from 'discord.js';
import { Music } from '../music';
import { LanguageKeyPath } from '../translation';
import { MusicClient } from './client';

export class ClientEventHandler {
    private client: MusicClient;
    private slashCommandQueue: CommandInteraction[];
    private buttonClickQueue: { [messageId: string]: ButtonInteraction[] };
    private threadMessageQueue: { [messageId: string]: Message[] };

    constructor(client: MusicClient) {
        this.client = client;
        this.slashCommandQueue = [];
        this.buttonClickQueue = {};
        this.threadMessageQueue = {};
    }

    get permissionChecker() {
        return this.client.permsChecker;
    }

    get musics() {
        return this.client.musics;
    }

    private translate(guildId: string | null, keys: LanguageKeyPath) {
        return this.client.translate(guildId, keys);
    }

    public async subscribe(token: string): Promise<void> {
        this.client.on('ready', async () => {
            if (!this.client.user) return;

            console.log('------------------------------------');
            console.log(`  Logged in as user ${this.client.user.tag}`);
            console.log('------------------------------------');

            await this.client.registerSlashCommands(token);
            await this.client.archiveOldThreads();
            this.client.user.setActivity(
                '/' + this.client.translate(null, ['slashCommand', 'name']),
                {
                    type: 'PLAYING',
                },
            );

            console.log('Client ready!\n');
        });

        this.client.on('error', (error: Error) => {
            this.handleError(error);
        });

        this.client.on('interactionCreate', (interaction) => {
            this.handleInteraction(interaction);
        });

        this.client.on('messageCreate', (message) => {
            if (message.channel instanceof ThreadChannel) {
                if (!(message.channel.id in this.threadMessageQueue))
                    this.threadMessageQueue[message.channel.id] = [];
                this.threadMessageQueue[message.channel.id].push(message);
                if (this.threadMessageQueue[message.channel.id].length == 1)
                    this.handleThreadMessage(message);
            }
        });

        this.client.on('messageDelete', (message) => {
            if (message.guildId && message.author?.id === this.client.user?.id)
                this.client.destroyMusic(message.guildId);
        });

        this.client.on('threadDelete', (thread) => {
            if (thread.guildId && thread.ownerId === this.client.user?.id)
                this.client.destroyMusic(thread.guildId);
        });

        this.client.on('guildCreate', (guild) => {
            this.client.registerSlashCommand(guild.id, token);
        });
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

    private async handleThreadMessage(message: Message): Promise<void> {
        if (
            message.guildId &&
            this.musics[message.guildId] &&
            message.channel instanceof ThreadChannel &&
            message.content &&
            message.channel.ownerId === this.client.user?.id
        ) {
            await this.musics[message.guildId].actions.addSongToQueue(
                message.content.split('\n'),
            );
        }
        this.threadMessageQueue[message.channel.id].shift();
        if (this.threadMessageQueue[message.channel.id].length === 0)
            delete this.threadMessageQueue[message.channel.id];
        else
            this.handleThreadMessage(
                this.threadMessageQueue[message.channel.id][0],
            );
    }

    private async handleInteraction(interaction: Interaction): Promise<void> {
        if (
            !interaction.guildId ||
            (!interaction.isButton() && !interaction.isCommand()) ||
            !interaction.member ||
            !(interaction.member instanceof GuildMember)
        )
            return;
        if (!this.permissionChecker.checkMemberRoles(interaction.member)) {
            await interaction.reply({
                content:
                    this.client.translate(interaction.guildId, [
                        'error',
                        'missingRole',
                    ]) + `\`${this.permissionChecker.roles.join(', ')}\``,
                ephemeral: true,
            });
            return;
        }
        if (
            interaction.isButton() &&
            interaction.component instanceof MessageButton
        ) {
            if (!(interaction.message.id in this.buttonClickQueue))
                this.buttonClickQueue[interaction.message.id] = [];
            this.buttonClickQueue[interaction.message.id].push(interaction);
            if (this.buttonClickQueue[interaction.message.id].length === 1)
                this.handleButtonClick(interaction);
            return;
        }
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

    private handleButtonClick(interaction: ButtonInteraction): void {
        if (
            interaction.guildId !== undefined &&
            interaction.guildId !== null &&
            interaction.guildId in this.musics &&
            this.musics[interaction.guildId] !== null &&
            this.musics[interaction.guildId] !== undefined
        ) {
            if (
                interaction.component.label !== null &&
                interaction.component.label !== undefined
            )
                this.musics[interaction.guildId].actions
                    .executeActionFromInteraction(interaction)
                    .then((value) => {
                        if (
                            value ||
                            !interaction.guildId ||
                            !interaction.component.label
                        )
                            return;
                        this.musics[
                            interaction.guildId
                        ].commands.executeFromInteraction(interaction);
                    });
        }
        this.buttonClickQueue[interaction.message.id].shift();
        if (this.buttonClickQueue[interaction.message.id].length === 0)
            delete this.buttonClickQueue[interaction.message.id];
        else
            this.handleButtonClick(
                this.buttonClickQueue[interaction.message.id][0],
            );
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
            this.permissionChecker.checkClientText(interaction.channel)
        ) {
            console.log('Handle slash command:', interaction.id);

            if (this.client.musicExists(interaction.guildId)) {
                /* if musics exists notify user
                 * and send the link to the music thread */

                this.musics[interaction.guildId].thread
                    ?.fetchStarterMessage()
                    .then(async (message) => {
                        return interaction.reply({
                            content:
                                this.translate(interaction.guildId, [
                                    'error',
                                    'activeThread',
                                ]) +
                                '\n' +
                                message.url,
                            ephemeral: true,
                            fetchReply: true,
                        });
                    })
                    .catch((error) => {
                        this.handleError(error);
                    });
            } else {
                // if valid member start a new music object in the channel

                this.permissionChecker
                    .validateMemberVoice(interaction)
                    .then((result) => {
                        if (!result) return;

                        console.log(
                            `Initializing queue message in guild ${interaction.guildId}`,
                        );

                        Music.newMusic(this.client, interaction).then(
                            (music) => {
                                if (interaction.guildId && music)
                                    this.client.musics[
                                        interaction.guildId
                                    ] = music;
                            },
                        );
                    });
            }
        }
        this.slashCommandQueue.shift();
        if (this.slashCommandQueue.length > 0)
            this.handleSlashCommand(this.slashCommandQueue[0]);
    }
}
