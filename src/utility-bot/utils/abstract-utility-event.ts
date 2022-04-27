import { LanguageKeyPath } from '../../..';
import { ClientEventQueue } from '../../utils/client-event-queue';
import { UtilityClient } from '../client';

export abstract class AbstractUtilityEvent {
    public once?: boolean;
    public client: UtilityClient;
    public needsClientReady = true;
    public eventQueue: ClientEventQueue;

    public constructor(client: UtilityClient) {
        this.client = client;
        this.eventQueue = new ClientEventQueue();
    }

    public translate(keys: LanguageKeyPath, ...args: string[]): string {
        return this.client.translate(keys, args);
    }

    public async callback(...args: any[]): Promise<void> {
        this.client.logger.debug(args.length.toString());
        return;
    }

    public static get eventName(): string {
        let n: string = this.name;
        n = n.replace(/^On/, '');
        n = n[0].toLowerCase() + n.substring(1);
        return n;
    }

    public static get help(): string | undefined {
        return undefined;
    }
}
