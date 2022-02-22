import {
    ButtonInteraction,
    MessageActionRow,
    MessageButton,
} from 'discord.js';
import { CommandName, getCommand } from './commands';
import { MusicClient } from './client';
import { AbstractCommand } from './models';
import { Queue } from './entities';

export class MusicCommands {
    private client: MusicClient;

    constructor(client: MusicClient) {
        this.client = client;
    }

    public async execute(name: CommandName, guildId: string): Promise<void> {
        const command: AbstractCommand | null = getCommand(
            name,
            guildId,
            this.client,
        );
        if (!command) return;
        command.execute().catch((e) => {
            console.error('Error when executing command');
            this.client.handleError(e);
        });
    }

    public async executeFromInteraction(
        interaction: ButtonInteraction,
    ): Promise<void> {
        if (!interaction.guildId || !this.client.user) return;
        const queue: Queue | undefined = await Queue.findOne({
            guildId: interaction.guildId,
            clientId: this.client.user.id,
        });
        if (!queue) return;
        for (let i = 0; i < Object.keys(CommandName).length; i++) {
            const command: AbstractCommand | null = getCommand(
                i,
                interaction.guildId,
                this.client,
            );
            if (!command) continue;
            const button: MessageButton | null = command.button2(queue);
            if (!button) continue;
            if (button.label && interaction.component.label === button.label)
                return command.execute(interaction).catch((e) => {
                    console.error('Error when executing command');
                    this.client.handleError(e);
                });
        }
    }

    public getCommandsActionRow(queue: Queue): MessageActionRow[] {
        const buttons: MessageButton[] = [];
        for (let i = 0; i < Object.keys(CommandName).length; i++) {
            const command: AbstractCommand | null = getCommand(
                i,
                queue.guildId,
                this.client,
            );
            const button: MessageButton | null | undefined =
                command?.button(queue);
            if (!command || !button) continue;
            buttons.push(button);
        }
        const rows: MessageActionRow[] = [];
        rows.push(new MessageActionRow());
        const rowLenSequence: number[] = [4, 5, 3, 3];
        let idx = 0;
        let lenIdx = 0;
        for (let i = 0; i < buttons.length; i++) {
            const len: number =
                idx >= rowLenSequence.length ? 3 : rowLenSequence[idx];
            if (buttons.length > len && i === lenIdx + len) {
                lenIdx += len;
                rows.push(new MessageActionRow());
                idx += 1;
            }
            rows[idx].addComponents(buttons[i]);
        }
        if (rows[0].components.length === 0) return [];
        return rows;
    }

    public getAllDescriptions(guildId: string): string[] {
        const descriptions: string[] = [];
        for (let i = 0; i < Object.keys(CommandName).length; i++) {
            const command: AbstractCommand | null = getCommand(
                i,
                guildId,
                this.client,
            );
            if (!command || !command.description) continue;
            descriptions.push(command.description);
        }
        return descriptions;
    }
}
