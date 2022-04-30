import { handleErrors } from '../../utils';
import { UtilityClient } from '../client';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnError extends AbstractUtilityEvent {
    public constructor(client: UtilityClient) {
        super(client);
    }

    public async callback(error: Error): Promise<void> {
        /* if discordApiError, do not log errors when fetching already
         * deleted messages or missing permissions to delete threads...*/
        return handleErrors(error);
    }
}

export namespace OnError {
    export type Type = ['error', ...Parameters<OnError['callback']>];
}
