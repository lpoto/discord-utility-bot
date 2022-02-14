import {
    ButtonInteraction,
    MessageActionRow,
    MessageButton,
} from 'discord.js';
import {
    CommandName,
    getCommand,
    MusicCommandOptions,
    MusicCommandOptionsPartial,
} from './commands';
import { Music } from '../music';
import { Command } from './models/command';

export class MusicCommands {
    private music: Music;

    constructor(music: Music) {
        this.music = music;
    }

    public async execute(options: MusicCommandOptionsPartial): Promise<void> {
        const options2: MusicCommandOptions = options as MusicCommandOptions;
        options2.music = this.music;
        const command: Command | null = getCommand(options2);
        if (!command) return;
        try {
            command.execute();
        } catch (e) {
            console.error('Error when executing command');
        }
    }

    public async executeFromInteraction(
        interaction: ButtonInteraction,
    ): Promise<void> {
        for (let i = 0; i < Object.keys(CommandName).length; i++) {
            const command: Command | null = getCommand({
                name: i,
                music: this.music,
            });
            if (!command) continue;
            const button: MessageButton | null = command.button;
            if (!button) continue;
            if (button.label && interaction.component.label === button.label)
                try {
                    return command.execute(interaction);
                } catch (e) {
                    console.log('Error when executing command');
                }
        }
    }

    public getCommandsActionRow(): MessageActionRow[] | null {
        const buttons: MessageButton[] = [];
        for (let i = 0; i < Object.keys(CommandName).length; i++) {
            const command: Command | null = getCommand({
                name: i,
                music: this.music,
            });
            if (!command || !command.button) continue;
            buttons.push(command.button);
        }
        if (buttons.length < 1) return null;
        const rows: MessageActionRow[] = [];
        rows.push(new MessageActionRow());
        let idx = 0;
        let len = 5;
        let lenIdx = 0;
        for (let i = 0; i < buttons.length; i++) {
            if (buttons.length > len && i === lenIdx + len) {
                lenIdx += len;
                len = 4;
                rows.push(new MessageActionRow());
                idx += 1;
            }
            rows[idx].addComponents(buttons[i]);
        }
        return rows;
    }
}
