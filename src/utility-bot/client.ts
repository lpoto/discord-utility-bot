import { CustomClient } from '../utils';
import { UtilityClientOptions, Event } from './utility-bot';
import * as Events from './events';
import { BitFieldResolvable, Intents, IntentsString } from 'discord.js';

export class UtilityClient extends CustomClient {
    public constructor(options: UtilityClientOptions) {
        super(options);
    }

    public getEvents(): any[] {
        return Object.values(Events);
    }

    public emitEvent(...args: Event): void {
        super.emit(args[0] as string, args[1]);
    }

    protected static getRequiredIntents(): BitFieldResolvable<
        IntentsString,
        number
    > {
        return [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.GUILD_MEMBERS,
            Intents.FLAGS.GUILD_INTEGRATIONS,
        ];
    }
}
