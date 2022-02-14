import { Music } from '../music';

export class Timer {
    private duration: number;
    private tick: number;
    private timer: number;
    private func: () => void;
    private paused: boolean;
    private ended: boolean;
    private music: Music;
    private timeout: NodeJS.Timeout | null;

    constructor(
        music: Music,
        duration: number,
        tick: number,
        func: () => void,
    ) {
        this.music = music;
        this.duration = duration;
        this.tick = tick;
        this.timer = 0;
        this.func = func;
        this.paused = false;
        this.ended = false;
        this.timeout = null;
    }

    get time(): number {
        return this.timer;
    }

    get isActive(): boolean {
        return this.timer < this.duration;
    }

    get isPaused(): boolean {
        return this.paused;
    }

    public pause(): void {
        if (this.timeout) clearTimeout(this.timeout);
        this.paused = true;
    }

    public unpause(): void {
        this.paused = false;
        this.start();
    }

    public start(): void {
        if (this.timeout)
            try {
                clearTimeout(this.timeout);
            } catch (e) {
                return;
            }
        this.timeout = setTimeout(() => this.timerFun(), 1000);
        this.timeout.unref();
    }

    public stop(): void {
        this.ended = true;
        if (!this.timeout) return;
        clearTimeout(this.timeout);
    }

    private timerFun(): void {
        if (this.paused || this.ended) return;
        if (this.music.connection?.state.status !== 'ready')
            return this.start();
        this.timer += 1;
        if (this.timer >= this.duration) return;
        if (this.timer % this.tick === 0) this.func();
        return this.start();
    }
}
