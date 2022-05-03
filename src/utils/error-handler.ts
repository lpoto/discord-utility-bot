import { DiscordAPIError } from 'discord.js';
import { EntityNotFoundError } from 'typeorm';
import { Logger } from './logger';

export class ErrorHandler {
    private logger: Logger;
    private errors: Error[];

    public constructor(logger: Logger) {
        this.logger = logger;
        this.errors = [];
    }

    public add(error: Error): void {
        if (!this.filter(error)) return;
        this.errors.push(error);
    }

    public log(clearErrors: boolean = true): void {
        for (const error of this.errors) {
            const stack: string = error.stack ? error.stack : '';
            this.logger.error(`${error.name}: ${error.message} ${stack}`);
        }
        if (clearErrors) this.errors = [];
    }

    private filter(error: Error): boolean {
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
            return false;
        return true;
    }
}
