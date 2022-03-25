import { Message } from 'discord.js';
import { MusicClient } from '../client';
import { Queue, QueueOption } from '../entities';
import { AbstractClientEvent } from '../utils/abstract-client-event';

export class OnReady extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
        this.once = true;
    }

    public async callback(): Promise<void> {
        const queues: Queue[] = await Queue.find();
        for (let queue of queues) {
            const message: Message | null = await this.client
                .checkThreadAndMessage(queue, true)
                .catch(async (e) => {
                    this.client.emitEvent('error', e);
                    return null;
                });
            if (message == null) {
                await queue.remove().catch((e) => {
                    this.client.emitEvent('error', e);
                });
                continue;
            }
            queue.removeOptions([
                QueueOption.Options.STOP_SELECTED,
                QueueOption.Options.CLEAR_SELECTED,
            ]);
            queue = await queue.save();
        }
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
                type: 'LISTENING',
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
