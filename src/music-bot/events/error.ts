import { DiscordAPIError } from 'discord.js';
import { EntityNotFoundError } from 'typeorm';
import { MusicClient } from '../client';
import { AbstractMusicEvent } from '../utils/abstract-music-event';

export class OnError extends AbstractMusicEvent {
    public constructor(client: MusicClient) {
        super(client);
        process.on('uncaughtException', (error: Error) => {
            this.callback(error);
        });

        process.on('unhandledRejection', (error: Error) => {
            this.callback(error);
        });
    }

    public async callback(error: Error): Promise<void> {
        /* if discordApiError, do not log errors when fetching already
         * deleted messages or missing permissions to delete threads...*/
        if (!error) return;
        if (
            (error.name &&
                ['Error [INTERACTION_ALREADY_REPLIED]'].includes(
                    error.name.toString().trim(),
                )) ||
            error instanceof EntityNotFoundError ||
            (error instanceof DiscordAPIError &&
                error.code &&
                [
                    '10008',
                    '50013',
                    '10003',
                    '10062',
                    '50001',
                    '40060',
                    '50083',
                    '50005',
                ].includes(error.code.toString()))
        )
            return;
        console.error('Error: ', error);
    }
}

export namespace OnError {
    export type Type = ['error', ...Parameters<OnError['callback']>];
}
