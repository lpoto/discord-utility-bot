import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue, QueueOption } from '../entities';
import { AbstractCommand } from '../utils';

export class Help extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user || interaction.replied) return;

        const descriptions: string[] =
            this.client.musicActions.commands.getAllDescriptions(this.guildId);
        if (this.description?.length === 0) {
            interaction.reply({
                content: this.translate(['help']),
                ephemeral: true,
            });
        } else {
            interaction.reply({
                content: descriptions
                    .map((d) => {
                        return '*\u3000' + d;
                    })
                    .join('\n'),
                ephemeral: true,
            });
        }
    }

    public button(queue: Queue): MessageButton | null {
        if (!queue.hasOption(QueueOption.Options.EDITING)) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'help', 'label']))
            .setDisabled(false)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }
}
