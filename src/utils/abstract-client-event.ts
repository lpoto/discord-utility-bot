import { ClientEventQueue } from './client-event-queue';
import { CustomClient } from './custom-client';

export abstract class AbstractClientEvent {
    public once?: boolean;
    public client: CustomClient;
    public eventQueue: ClientEventQueue;

    public constructor(client: CustomClient) {
        this.client = client;
        this.eventQueue = new ClientEventQueue();
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
}
