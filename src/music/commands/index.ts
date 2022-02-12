import {
    ButtonInteraction,
    MessageActionRow,
    MessageButton,
} from 'discord.js';
import { Music } from '../music';
import { Command } from './command';
import { EditQueue } from './edit-queue';
import { Pause } from './pause';
import { Play } from './play';
import { Replay } from './replay';
import { Skip } from './skip';
import { Stop } from './stop';

export { Command } from './command';

export enum CommandName {
    PLAY,
    SKIP,
    PAUSE,
    REPLAY,
    STOP,
    REMOVE_FROM_QUEUE,
}

export interface MusicCommandOptionsPartial {
    name: CommandName;
    musicString?: string;
    duration?: number;
}

export interface MusicCommandOptions extends MusicCommandOptionsPartial {
    music: Music;
}

export class MusicCommands {
    private music: Music;

    constructor(music: Music) {
        this.music = music;
    }

    public async execute(options: MusicCommandOptionsPartial): Promise<void> {
        const options2: MusicCommandOptions = options as MusicCommandOptions;
        options2.music = this.music;
        const command: Command | null = this.get(options2);
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
            const command: Command | null = this.get({
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
            case CommandName.REMOVE_FROM_QUEUE:
                return new EditQueue(options);
            default:
                return null;
        }
    }
}
