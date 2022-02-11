import { MusicCommandOptions } from '.';
import { Command } from './command';

export class Play extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }
}
