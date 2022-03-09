import {
    ButtonInteraction,
    MessageActionRow,
    MessageButton,
} from 'discord.js';
import { MusicClient } from './client';
import { Queue } from './entities';
import * as Commands from './commands';
import { CommandName, Command } from '../';

export class MusicCommands {
    private client: MusicClient;

    constructor(client: MusicClient) {
        this.client = client;
    }

    /**
     * Execute a command that matches the name
     */
    public async execute(name: CommandName, guildId: string): Promise<void> {
        const command: Command | null = this.getCommand(name, guildId);
        if (!command) return;
        command.execute().catch((e) => {
            console.error('Error when executing command');
            this.client.handleError(e);
        });
    }

    /**
     * Execute a command that matches the button's label
     */
    public async executeFromInteraction(
        interaction: ButtonInteraction,
    ): Promise<void> {
        if (!interaction.guildId || !this.client.user) return;
        const queue: Queue | undefined = await Queue.findOne({
            guildId: interaction.guildId,
            clientId: this.client.user.id,
        });
        if (!queue) return;
        for (const val in Commands) {
            try {
                const command: Command | null = this.getCommand(
                    val,
                    interaction.guildId,
                );
                if (!command) continue;
                const button: MessageButton | null = command.button2(queue);
                if (!button) continue;
                if (
                    button.label &&
                    interaction.component.label === button.label
                )
                    return command.execute(interaction).catch((e) => {
                        console.error('Error when executing command');
                        this.client.handleError(e);
                    });
            } catch (e) {
                console.error(e);
            }
        }
    }

    /**
     * Build MessageActionRow from all of the commands' buttons
     */
    public getCommandsActionRow(queue: Queue): MessageActionRow[] {
        const buttons: MessageButton[] = [];
        for (const val in Commands) {
            try {
                const command: Command | null = this.getCommand(
                    val,
                    queue.guildId,
                );
                const button: MessageButton | null | undefined =
                    command?.button(queue);
                if (!command || !button) continue;
                buttons.push(button);
            } catch (e) {
                console.error(e);
            }
        }
        const rows: MessageActionRow[] = [];
        rows.push(new MessageActionRow());
        let lenIdx = 0;
        let idx = 0;
        for (let i = 0; i < buttons.length; i++) {
            const len: number = idx % 2 === 0 ? 4 : 5;
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

    /**
     * Build an array from all of the commands' descriptions
     */
    public getAllDescriptions(guildId: string): string[] {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new (<any>Commands)[val](this.client, guildId);
    }
}
