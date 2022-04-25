import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { Command } from '../music-bot';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractCommand } from '../utils';
import * as Commands from '../commands';

export class Help extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get alwaysExecute(): boolean {
        return true;
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user || interaction.replied) return;

        const descriptions: string[] = this.getAllDescriptions(this.guildId);
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public button(queue: Queue): MessageButton | null {
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'help', 'label']))
            .setDisabled(false)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    private getAllDescriptions(guildId: string): string[] {
        const descriptions: string[] = [];
        for (const val in Commands) {
            try {
                const command: Command | null = this.getCommand(val, guildId);
                if (!command || !command.description) continue;
                descriptions.push(command.description);
            } catch (e) {
                console.error(e);
            }
        }
        return descriptions;
    }

    private getCommand(val: string, guildId: string): Command | null {
        return new (<any>Commands)[val](this.client, guildId);
    }
}
