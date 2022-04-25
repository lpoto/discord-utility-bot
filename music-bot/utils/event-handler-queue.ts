import { EventHandlerQueueOptions } from '../music-bot';

export class EventHandlerQueue {
    private queues: {
        [queueName: string]: {
            [queueId: string]: (() => Promise<void>)[];
        };
    };
    public constructor() {
        this.queues = {};
    }

    public addToQueue(options: EventHandlerQueueOptions): void {
        const cb: (() => Promise<void>) | undefined = options.callback;
        if (!cb) return;
        const queueName: string = options.name;
        const queueId: string = options.id;
        if (!(queueName in this.queues)) this.queues[queueName] = {};
        if (!(queueId in this.queues[queueName]))
            this.queues[queueName][queueId] = [];
        this.queues[queueName][queueId].push(cb);
        this.handleCb({
            name: queueName,
            id: queueId,
        });
    }

    private async handleCb(
        options: EventHandlerQueueOptions,
        force?: boolean,
    ): Promise<void> {
        const queueName: string = options.name;
        const queueId: string = options.id;
        if (
            !(queueName in this.queues) ||
            !(queueId in this.queues[queueName])
        )
            return;
        if (
            queueId in this.queues[queueName] &&
            (force || this.queues[queueName][queueId].length === 1)
        ) {
            const cb: undefined | (() => Promise<void>) =
                this.queues[queueName][queueId].shift();

            if (cb !== undefined) await cb();

            if (
                queueName in this.queues &&
                queueId in this.queues[queueName] &&
                this.queues[queueName][queueId].length === 0
            )
                delete this.queues[queueName][queueId];
        }
        if (Object.keys(this.queues[queueName]).length === 0)
            delete this.queues[queueName];

        this.handleCb(options, true);
    }
}
