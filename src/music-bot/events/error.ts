import { handleErrors } from '../../utils';
import { MusicClient } from '../client';
import { AbstractMusicEvent } from '../utils/abstract-music-event';

export class OnError extends AbstractMusicEvent {
    public constructor(client: MusicClient) {
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
