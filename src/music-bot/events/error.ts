import { ErrorHandler } from '../../utils/error-handler';
import { MusicClient } from '../client';
import { AbstractMusicEvent } from '../utils/abstract-music-event';

export class OnError extends AbstractMusicEvent {
    public constructor(client: MusicClient) {
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
