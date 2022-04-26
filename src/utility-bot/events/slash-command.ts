import { CommandInteraction, GuildMember, TextChannel } from 'discord.js';
import { UtilityClient } from '../client';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';
import { Event } from '../utility-bot';

export class OnSlashCommand extends AbstractUtilityEvent {
    public constructor(client: UtilityClient) {
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
            this.client.user
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
                `Slash command ${interaction.id},`,
                `type: ${interaction.commandName}`,
            );
            try {
                const eventName = `${interaction.commandName}SlashCommand`;
                const args: Event = [eventName, interaction] as Event;
                this.client.emitEvent(...args);
            } catch (e) {
                return;
            }
        }
    }
}

export namespace OnSlashCommand {
    export type Type = [
        'slashCommand',
        ...Parameters<OnSlashCommand['callback']>,
    ];
}
