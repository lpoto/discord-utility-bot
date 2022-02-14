export interface MusicActivityOptions {
    isLoop?: boolean;
    isLoopQueue?: boolean;
    isStopRequested?: boolean;
    isClearRequested?: boolean;
    isPaused?: boolean;
    isEditing?: boolean;
    isPlaying?: boolean;
    isExpanded?: boolean;
    needsUpdate?: boolean;
}

export interface TimerOptions {
    totalTimer?: number;
    timer?: number;
    tickSize?: number;
}

export abstract class AbstractMusic {
    private options: MusicActivityOptions;
    private timerOptions: TimerOptions;

    constructor(options?: MusicActivityOptions, timerOptions?: TimerOptions) {
        this.options = options ? options : {};
        this.timerOptions = timerOptions ? timerOptions : {};
    }

    get loop(): boolean {
        return this.options.isLoop ? this.options.isLoop : false;
    }

    set loop(value: boolean) {
        this.options.isLoop = value;
    }

    get loopQueue(): boolean {
        return this.options.isLoopQueue ? this.options.isLoopQueue : false;
    }

    set loopQueue(value: boolean) {
        this.options.isLoopQueue = value;
    }

    get stopRequest(): boolean {
        return this.options.isStopRequested
            ? this.options.isStopRequested
            : false;
    }

    set stopRequest(value: boolean) {
        this.options.isStopRequested = value;
    }

    get clearRequest(): boolean {
        return this.options.isClearRequested
            ? this.options.isClearRequested
            : false;
    }

    set clearRequest(value: boolean) {
        this.options.isClearRequested = value;
    }

    get paused(): boolean {
        return this.options.isPaused ? this.options.isPaused : false;
    }

    set paused(value: boolean) {
        this.options.isPaused = value;
    }

    get editing(): boolean {
        return this.options.isEditing ? this.options.isEditing : false;
    }

    set editing(value: boolean) {
        this.options.isEditing = value;
    }

    get playing(): boolean {
        return this.options.isPlaying ? this.options.isPlaying : false;
    }

    set playing(value: boolean) {
        this.options.isPlaying = value;
    }

    get expanded(): boolean {
        return this.options.isExpanded ? this.options.isExpanded : false;
    }

    set expanded(value: boolean) {
        this.options.isExpanded = value;
    }

    get needsUpdate(): boolean {
        return (
            this.playing ||
            (this.options.needsUpdate ? this.options.needsUpdate : false)
        );
    }

    set needsUpdate(value: boolean) {
        this.options.needsUpdate = value;
    }

    get time(): number {
        if (!this.timerOptions.timer) this.timerOptions.timer = 0;
        return this.timerOptions.timer;
    }
    get totalTime(): number {
        if (!this.timerOptions.totalTimer) this.timerOptions.totalTimer = 0;
        return this.timerOptions.totalTimer;
    }

    public resetTimer(): void {
        this.timerOptions.timer = 0;
    }

    protected onTimerTick(): void {
        return;
    }

    protected startTimer(): void {
        const tickSize: number = this.timerOptions.tickSize
            ? this.timerOptions.tickSize
            : 1000;
        setTimeout(() => {
            this.timerOptions.totalTimer = this.totalTime + 1;
            this.timerOptions.timer = this.time + 1;
            this.onTimerTick();
            this.startTimer();
        }, tickSize);
    }
}
