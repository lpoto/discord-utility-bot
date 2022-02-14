import { Command } from '../models';
import { Music } from '../music';
import { Clear } from './clear';
import { EditQueue } from './edit-queue';
import { Expand } from './expand';
import { Forward } from './forward';
import { Help } from './help';
import { Pause } from './pause';
import { Play } from './play';
import { Remove } from './remove';
import { Replay } from './replay';
import { Shuffle } from './shuffle';
import { Skip } from './skip';
import { Stop } from './stop';

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
    EXPAND,
    HELP,
}

export interface MusicCommandOptionsPartial {
    name: CommandName;
    musicString?: string;
    duration?: number;
}

export interface MusicCommandOptions extends MusicCommandOptionsPartial {
    music: Music;
}

export function getCommand(options: MusicCommandOptions): Command | null {
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
        case CommandName.EXPAND:
            return new Expand(options);
        case CommandName.HELP:
            return new Help(options);
        default:
            return null;
    }
}
