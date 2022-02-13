import {
    ButtonInteraction,
    MessageActionRow,
    MessageButton,
} from 'discord.js';
import { Music } from '../music';
import { Clear } from './clear';
import { Command } from './command';
import { EditQueue } from './edit-queue';
import { Forward } from './forward';
import { Pause } from './pause';
import { Play } from './play';
import { Remove } from './remove';
import { Replay } from './replay';
import { Shuffle } from './shuffle';
import { Skip } from './skip';
import { Stop } from './stop';

export { Command } from './command';

export enum CommandName {
    PLAY,
    SKIP,
    PAUSE,
    REPLAY,
    STOP,
    EDIT,
    FORWARD,
    REMOVE,
    SHUFFLE,
    CLEAR,
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

    public getCommandsActionRow(): MessageActionRow[] | null {
        const buttons: MessageButton[] = [];
        for (let i = 0; i < Object.keys(CommandName).length; i++) {
            const command: Command | null = this.get({
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
        for (let i = 0; i < buttons.length; i++) {
            if (buttons.length > 5 && i > 0 && i % 5 === 0) {
                rows.push(new MessageActionRow());
                idx += 1;
            }
            rows[idx].addComponents(buttons[i]);
        }
        return rows;
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
            case CommandName.EDIT:
                return new EditQueue(options);
            case CommandName.CLEAR:
                return new Clear(options);
            case CommandName.REMOVE:
                return new Remove(options);
            case CommandName.FORWARD:
                return new Forward(options);
            case CommandName.SHUFFLE:
                return new Shuffle(options);
            default:
                return null;
        }
    }
}
