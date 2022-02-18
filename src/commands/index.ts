import { AbstractCommand } from '../models/abstract-command';
import { MusicClient } from '../client';
import { Clear } from './clear';
import { EditQueue } from './edit-queue';
import { Expand } from './expand';
import { Forward } from './forward';
import { Help } from './help';
import { Loop } from './loop';
import { LoopQueue } from './loop-queue';
import { PageBackward } from './page-backward';
import { PageForward } from './page-forward';
import { Pause } from './pause';
import { Play } from './play';
import { Remove } from './remove';
import { Replay } from './replay';
import { Shuffle } from './shuffle';
import { Skip } from './skip';
import { Stop } from './stop';
import { Join } from './join';

export enum CommandName {
    PLAY,
    JOIN,
    PAGE_BACKWARD,
    PAGE_FORWARD,
    LOOP,
    LOOP_QUEUE,
    SKIP,
    PAUSE,
    REPLAY,
    STOP,
    EDIT,
    SONG_FORWARD,
    REMOVE,
    SHUFFLE,
    CLEAR,
    EXPAND,
    HELP,
}

export function getCommand(
    name: CommandName,
    guildId: string,
    client: MusicClient,
): AbstractCommand | null {
    switch (name) {
        case CommandName.PLAY:
            return new Play(client, guildId);
        case CommandName.JOIN:
            return new Join(client, guildId);
        case CommandName.PAGE_FORWARD:
            return new PageForward(client, guildId);
        case CommandName.PAGE_BACKWARD:
            return new PageBackward(client, guildId);
        case CommandName.LOOP:
            return new Loop(client, guildId);
        case CommandName.LOOP_QUEUE:
            return new LoopQueue(client, guildId);
        case CommandName.SKIP:
            return new Skip(client, guildId);
        case CommandName.PAUSE:
            return new Pause(client, guildId);
        case CommandName.REPLAY:
            return new Replay(client, guildId);
        case CommandName.STOP:
            return new Stop(client, guildId);
        case CommandName.EDIT:
            return new EditQueue(client, guildId);
        case CommandName.CLEAR:
            return new Clear(client, guildId);
        case CommandName.REMOVE:
            return new Remove(client, guildId);
        case CommandName.SONG_FORWARD:
            return new Forward(client, guildId);
        case CommandName.SHUFFLE:
            return new Shuffle(client, guildId);
        case CommandName.EXPAND:
            return new Expand(client, guildId);
        case CommandName.HELP:
            return new Help(client, guildId);
        default:
            return null;
    }
}
