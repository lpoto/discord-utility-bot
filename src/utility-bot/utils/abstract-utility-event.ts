import { ClientEventQueue } from '../../utils/client-event-queue';
import { UtilityClient } from '../client';

export abstract class AbstractUtilityEvent {
    public once?: boolean;
    public client: UtilityClient;
    public eventQueue: ClientEventQueue;

    public constructor(client: UtilityClient) {
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
