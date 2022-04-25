export class ClientEventQueue {
    private queues: {
        [queueId: string]: (() => Promise<void>)[];
    };
    public constructor() {
        this.queues = {};
    }

    public addToQueue(id: string, callback: () => Promise<void>): void {
        if (!(id in this.queues)) this.queues[id] = [];
        this.queues[id].push(callback);
        this.handleCb(id);
    }

    private async handleCb(id: string, force?: boolean): Promise<void> {
        if (!(id in this.queues)) return;
        if (id in this.queues && (force || this.queues[id].length === 1)) {
            const cb: undefined | (() => Promise<void>) =
                this.queues[id].shift();

            if (cb !== undefined) await cb();

            if (id in this.queues && this.queues[id].length === 0)
                delete this.queues[id];
        }
        this.handleCb(id, true);
    }
}
