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
                    message = await this.client.checkThreadAndMessage(queue);

                if (queue && message) {
                    interaction.reply({
                        content: this.client.translate(
                            interaction.guildId,
                            ['error', 'activeThread'],
                            [message.url],
                        ),
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
        ...Parameters<OnSlashCommand['callback']>
    ];
}
