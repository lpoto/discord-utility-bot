import { MusicClient } from '../client';
import { ClientEventQueue } from './client-event-queue';
import { ClientEventArgument } from '../music-bot';

export class AbstractClientEvent {
    public once?: boolean;
    public client: MusicClient;
    public eventQueue: ClientEventQueue;

    public constructor(client: MusicClient) {
        this.client = client;
        this.eventQueue = new ClientEventQueue();
    }

    public async callback(...args: ClientEventArgument[]): Promise<void> {
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
