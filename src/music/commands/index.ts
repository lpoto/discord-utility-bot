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
    STOP,
    SKIP,
    REPLAY,
    PAUSE,
}

export interface MusicCommandOptions {
    name: CommandName;
    music: Music;
    musicString?: string;
    duration?: number;
}

export function executeCommand(options: MusicCommandOptions): void {
    const command: Command | null = getCommand(options);
    command?.execute()
}

function getCommand(options: MusicCommandOptions): Command | null {
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
