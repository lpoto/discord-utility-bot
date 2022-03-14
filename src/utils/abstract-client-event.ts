import { MusicClient } from '../client';
import { ClientEventQueue } from './client-event-queue';
import { ClientEventArgument } from '../../';

export class AbstractClientEvent {
    public name: string;
    public once?: boolean;
    public client: MusicClient;
    public eventQueue: ClientEventQueue;

    public constructor(client: MusicClient) {
        this.name = 'x';
        this.client = client;
        this.eventQueue = new ClientEventQueue();
    }

    public async callback(...args: ClientEventArgument[]): Promise<void> {
        console.log(args.length);
        return;
    }
}
