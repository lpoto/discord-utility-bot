import { VoiceConnection } from '@discordjs/voice';
import {
    CommandInteraction,
    GuildMember,
    Message,
    TextChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractMusicEvent } from '../utils/abstract-music-event';

export class OnSlashCommand extends AbstractMusicEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(interaction: CommandInteraction): Promise<void> {
        if (
            interaction.guildId &&
            interaction.guild &&
            interaction.guild.me &&
            interaction.channel &&
            interaction.channel instanceof TextChannel &&
            interaction.member &&
            this.client.user &&
            interaction.member instanceof GuildMember &&
            this.client.permsChecker.checkClientText(
                interaction.channel,
                interaction,
            )
        ) {
            this.eventQueue.addToQueue(interaction.id, () =>
                this.execute(interaction),
            );
        }
    }

    private async execute(interaction: CommandInteraction): Promise<void> {
        if (
            this.client.user &&
            interaction.guildId &&
            interaction.guild &&
            interaction.guild.me &&
            interaction.channel &&
            interaction.channel instanceof TextChannel &&
            interaction.member &&
            interaction.member instanceof GuildMember
        ) {
            this.client.logger.debug(
                'Handle slash command: ',
                interaction.commandName,
                interaction.id,
            );

            const commands =
                this.client.translator.getFullLanguage().music.slashCommands;

            if (interaction.commandName === commands[1].name) {
                return this.client.emitEvent('executeCommand', {
                    name: 'Help',
                    interaction: interaction,
                    guildId: interaction.guildId,
                });
            }

            await Queue.findOne({
                guildId: interaction.guildId,
                clientId: this.client.user.id,
            }).then(async (queue) => {
                let message: Message | null = null;
                if (queue)
                    message = await this.client.checkThreadAndMessage(queue);

                if (message) {
                    interaction.reply({
                        content: this.client.translate(
                            ['music', 'error', 'activeThread'],
                            message.url,
                        ),
                        ephemeral: true,
                        fetchReply: true,
                    });
                } else if (
                    this.client.user &&
                    interaction.guildId &&
                    this.client.permsChecker.validateMemberVoice(interaction)
                ) {
                    this.client.logger.info(
                        `Initializing queue message in guild '${interaction.guildId}'`,
                    );

                    const c: VoiceConnection | null =
                        this.client.getVoiceConnection(interaction.guildId);

                    if (
                        !c ||
                        (interaction.guildId &&
                            !this.client.getVoiceConnection(
                                interaction.guildId,
                            )) ||
                        !interaction.guild?.me?.voice.channel
                    )
                        this.client.emitEvent('joinVoiceRequest', interaction);

                    const q: Queue = Queue.create({
                        clientId: this.client.user.id,
                        offset: 0,
                        curPageSongs: [],
                        options: [],
                    });

                    this.client.emitEvent('queueMessageUpdate', {
                        queue: q,
                        interaction: interaction,
                    });
                }
            });
        }
    }
}

export namespace OnSlashCommand {
    export type Type = [
        'slashCommand',
        ...Parameters<OnSlashCommand['callback']>,
    ];
}
