import { Music } from '../music';

export type CommandName =
    | 'PLAY'
    | 'STOP'
    | 'SKIP'
    | 'REPLAY'
    | 'LOOP'
    | 'LOOP_QUEUE'
    | 'PAUSE';

export function fetchCommand(
    commandName: CommandName,
    music: Music,
): Command | null {
    console.log(music);

    switch (commandName) {
        default:
            return null;
    }
}

abstract class Command {
    private music: Music;

    constructor(music: Music) {
        this.music = music;
    }

    public async execute(): Promise<void> {
        console.log(this.music);
    }
}
