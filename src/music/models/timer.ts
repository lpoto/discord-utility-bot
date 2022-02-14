export class Timer {
    private duration: number;
    private tick: number;
    private timer: number;
    private func: () => void;
    private ended: boolean;

    constructor(duration: number, tick: number, func: () => void) {
        this.duration = duration;
        this.tick = tick;
        this.timer = 0;
        this.func = func;
        this.ended = false;
    }

    get time(): number {
        return this.timer;
    }

    get isActive(): boolean {
        return !this.ended && this.timer < this.duration;
    }

    public start(): void {
        setTimeout(() => {
            if (this.ended) return;
            this.timer += this.tick / 1000;
            if (this.timer >= this.duration) return;
            this.func();
            this.start();
        }, this.tick);
    }

    public stop(): void {
        this.ended = true;
    }
}
