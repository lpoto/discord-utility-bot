import {
    ButtonInteraction,
    CommandInteraction,
    MessageButton,
} from 'discord.js';
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

    public get joinVoice(): boolean {
        return false;
    }

    public get checkMemberPerms(): boolean {
        return false;
    }

    public async execute(
        interaction?: ButtonInteraction | CommandInteraction,
    ): Promise<void> {
        if (!interaction || !interaction.user || interaction.replied) return;

        const descriptions: string[] = this.getAllSlashCommands().concat(
            this.getAllDescriptions(this.guildId),
        );
        if (this.description?.length === 0) {
            interaction.reply({
                content: this.translate(['music', 'help']),
                ephemeral: true,
            });
        } else {
            interaction.reply({
                content:
                    `${this.translate(['music', 'name'])} ${
                        this.client.version
                    }\n\n` +
                    descriptions
                        .map((d) => {
                            return '> \u3000' + d;
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

    private getAllSlashCommands(): string[] {
        const h: string[] = [];
        for (const c of this.client.translator.getFullLanguage().music
            .slashCommands) {
            h.push(`\`/${c.name}\`: ${c.description}`);
            if (!c.help) continue;
            for (const c2 of c.help) h.push(`\u3000\u3000-\u2000${c2}`);
        }
        return h.concat(['']);
    }

    private getAllDescriptions(guildId: string): string[] {
        const descriptions: string[] = [];
        for (const val in Commands) {
            try {
                const command: Command | null = this.getCommand(val, guildId);
                if (!command || !command.description) continue;
                descriptions.push(command.description);
                if (command.additionalHelp)
                    descriptions.push(
                        '\u3000\u3000- ' + command.additionalHelp,
                    );
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
