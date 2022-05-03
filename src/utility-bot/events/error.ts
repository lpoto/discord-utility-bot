import { ErrorHandler } from '../../utils/error-handler';
import { UtilityClient } from '../client';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnError extends AbstractUtilityEvent {
    public constructor(client: UtilityClient) {
        super(client);
    }

    public async callback(error: Error): Promise<void> {
        /* if discordApiError, do not log errors when fetching already
         * deleted messages or missing permissions to delete threads...*/
        const handler: ErrorHandler = new ErrorHandler(this.client.logger);
        handler.add(error);
        handler.log();
    }
}

export namespace OnError {
    export type Type = ['error', ...Parameters<OnError['callback']>];
}
