import { MusicClient } from '../client';
import { Queue, QueueOption } from '../entities';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnReady extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
        this.once = true;
    }

    public async callback(): Promise<void> {
        Queue.find().then((queues) => {
            for (const queue of queues)
                this.client.checkThreadAndMessage(queue, true).catch((e) => {
                    this.client.emitEvent('error', e);
                });
        });
        await this.setup();
    }

    private async setup(): Promise<void> {
        if (!this.client.user) return;

        console.log('------------------------------------');
        console.log(`  Logged in as user ${this.client.user.tag}`);
        console.log('------------------------------------');

        await this.client.translator.setup();
        await QueueOption.seed();
        await this.client.registerSlashCommands();
        this.client.user.setActivity(
            '/' + this.client.translate(null, ['slashCommand', 'name']),
            {
                type: 'PLAYING',
            },
        );
        this.client.ready = true;
        console.log('------------------------------------');
        console.log('  Client ready!');
        console.log('------------------------------------');
    }
}

export namespace OnReady {
    export type Type = ['ready', ...Parameters<OnReady['callback']>];
}
