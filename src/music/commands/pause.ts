import { MusicCommandOptions } from '.';
import { Command } from './command';

export class Pause extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }
}
