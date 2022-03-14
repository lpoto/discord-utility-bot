import { DiscordAPIError } from 'discord.js';
import { MusicClient } from '../client';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnError extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
        this.name = 'error';
        process.on('uncaughtException', (error: Error) => {
            this.callback(error);
        });

        process.on('unhandledRejection', (error: Error) => {
            this.callback(error);
        });
    }

    public async callback(error: Error): Promise<void> {
        try {
            /* if discordApiError, do not log errors when fetching already
             * deleted messages or missing permissions to delete threads...*/
            const discordError: DiscordAPIError = error as DiscordAPIError;
            if (
                discordError.code &&
                [
                    '10008',
                    '50013',
                    '10003',
                    '10062',
                    '50001',
                    '40060',
                    '50083',
                    '50005',
                ].includes(discordError.code.toString())
            )
                return;
        } catch (e) {
            console.error('Error: ', e);
            return;
        }
        console.error('Error: ', error);
    }
}
