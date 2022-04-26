import { CustomClient } from '../utils';
import { UtilityClientOptions, Event } from './utility-bot';
import * as Events from './events';

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
}
