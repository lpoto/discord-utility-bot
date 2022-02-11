import {
    ButtonInteraction,
    MessageActionRow,
    MessageButton,
} from 'discord.js';
import { Music } from '../music';
import { Command } from './command';
import { Pause } from './pause';
import { Play } from './play';
import { Replay } from './replay';
import { Skip } from './skip';
import { Stop } from './stop';

export { Command } from './command';

export enum CommandName {
    PLAY,
    SKIP,
    REPLAY,
    PAUSE,
    STOP,
}

export interface MusicCommandOptionsPartial {
    music: Music;
    musicString?: string;
    duration?: number;
}

export interface MusicCommandOptions extends MusicCommandOptionsPartial {
    name: CommandName;
}

export class MusicCommands {
    private music: Music;

    constructor(music: Music) {
        this.music = music;
    }

    public async execute(options: MusicCommandOptionsPartial): Promise<void> {
        options.music = this.music;
        const command: Command | null = this.get(
            options as MusicCommandOptions,
        );
        command?.execute();
    }

    public async executeFromInteraction(interaction: ButtonInteraction) {
        for (let i = 0; i < Object.keys(CommandName).length; i++) {
            const command: Command | null = this.get({
                name: i,
                music: this.music,
            });
            if (!command) continue;
            const button: MessageButton | null = command.button;
            if (!button) continue;
            if (button.label && interaction.component.label === button.label)
                return await command.execute(interaction);
        }
    }

    public getCommandsActionRow(): MessageActionRow | null {
        const row: MessageActionRow = new MessageActionRow();
        for (let i = 0; i < Object.keys(CommandName).length; i++) {
            const command: Command | null = this.get({
                name: i,
                music: this.music,
            });
            if (!command || !command.button) continue;
            row.addComponents(command.button);
        }
        return row.components.length === 0 ? null : row;
    }

    private get(options: MusicCommandOptions): Command | null {
        switch (options.name) {
            case CommandName.PLAY:
                return new Play(options);
            case CommandName.SKIP:
                return new Skip(options);
            case CommandName.REPLAY:
                return new Replay(options);
            case CommandName.STOP:
                return new Stop(options);
            case CommandName.PAUSE:
                return new Pause(options);
            default:
                return null;
        }
    }
}
