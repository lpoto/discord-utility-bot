import { CustomClient } from '../utils';
import { UtilityClientOptions } from './utility-bot';
import * as Events from './events';

export class UtilityClient extends CustomClient {
    public constructor(options: UtilityClientOptions) {
        super(options);
    }

    public getEvents(): any[] {
        return Object.values(Events);
    }
}
