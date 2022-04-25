import { ClientEventQueue } from '../../utils/client-event-queue';
import { MusicClient } from '../client';

export abstract class AbstractMusicEvent {
    public once?: boolean;
    public client: MusicClient;
    public eventQueue: ClientEventQueue;

    public constructor(client: MusicClient) {
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
