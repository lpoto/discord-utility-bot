import { GuildMember, Interaction, TextChannel } from 'discord.js';
import { UtilityClient } from '../client';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnInteractionCreate extends AbstractUtilityEvent {
    public constructor(client: UtilityClient) {
        super(client);
    }

    public async callback(interaction: Interaction): Promise<void> {
        if (
            interaction.guildId &&
            interaction.guild &&
            interaction.guild.me &&
            interaction.channel &&
            this.client.user &&
            interaction.applicationId === this.client.user.id &&
            interaction.channel instanceof TextChannel &&
            (interaction.isButton() ||
                interaction.isCommand() ||
                interaction.isSelectMenu()) &&
            interaction.member &&
            interaction.member instanceof GuildMember &&
            this.client.user &&
            this.client.permsChecker.checkClientText(
                interaction.channel,
                interaction,
                interaction.member,
            )
        ) {
            this.execute(interaction);
        }
    }

    private async execute(interaction: Interaction): Promise<void> {
        const type: string = interaction.isButton()
            ? 'buttonClick'
            : interaction.isSelectMenu()
            ? 'selectMenu'
            : 'slashCommand';
        this.client.logger.debug(
            `Interaction ${interaction.id}, type: ${type}`,
        );
        if (interaction.isCommand())
            this.client.emitEvent('slashCommand', interaction);
        if (interaction.isButton())
            this.client.emitEvent('buttonClick', interaction);
        if (interaction.isSelectMenu())
            this.client.emitEvent('menuSelect', interaction);
    }
}

export namespace OnInteractionCreate {
    export type Type = [
        'slashCommand',
        ...Parameters<OnInteractionCreate['callback']>,
    ];
}
