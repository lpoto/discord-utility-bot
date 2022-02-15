export class Timer {
    private timer: number;
    private execute: () => void;
    private check: () => boolean;
    private dest = false;

    constructor(execute: () => void, check: () => boolean) {
        this.timer = 0;
        this.execute = execute;
        this.check = check;
        this.start();
    }

    get time(): number {
        return Math.round(this.timer);
    }

    public isActive(): boolean {
        return this.check();
    }

    public reset(): void {
        this.timer = 0;
    }

    public destroy(): void {
        this.dest = true;
    }

    private start(): void {
        const interval: NodeJS.Timer = setInterval(() => {
            if (this.dest) clearInterval(interval);
            if (this.check()) {
                this.timer += 0.5;
                if (this.timer % 3 === 0) this.execute();
            }
        }, 500);
        interval.unref();
    }
}
