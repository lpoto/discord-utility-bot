import {
    CommandInteraction,
    GuildMember,
    Message,
    TextChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnSlashCommand extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
        this.name = 'slashCommand';
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
            this.client.permsChecker.checkClientText(interaction.channel)
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
            console.log('Handle slash command:', interaction.id);

            await Queue.findOne({
                guildId: interaction.guildId,
                clientId: this.client.user.id,
            }).then(async (queue) => {
                let message: Message | null = null;
                if (queue)
                    message =
                        await this.client.utilityActions.checkThreadAndMessage(
                            queue,
                        );

                if (queue && message) {
                    interaction.reply({
                        content:
                            this.client.translate(interaction.guildId, [
                                'error',
                                'activeThread',
                            ]) +
                            '\n' +
                            message.url,
                        ephemeral: true,
                        fetchReply: true,
                    });
                } else if (
                    this.client.user &&
                    this.client.permsChecker.validateMemberVoice(interaction)
                ) {
                    console.log(
                        `Initializing queue message in guild ${interaction.guildId}`,
                    );

                    const q: Queue = Queue.create({
                        clientId: this.client.user.id,
                        offset: 0,
                        curPageSongs: [],
                        options: [],
                        color: Math.floor(Math.random() * 16777215),
                    });

                    this.client.musicActions
                        .replyWithQueue(q, interaction)
                        .then((result) => {
                            if (
                                result &&
                                q.messageId &&
                                q.threadId &&
                                q.channelId &&
                                q.guildId
                            )
                                Queue.save(q);
                        });
                }
            });
        }
    }
}
