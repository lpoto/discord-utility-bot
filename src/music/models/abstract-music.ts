export interface MusicActivityOptions {
    isLoop?: boolean;
    isLoopQueue?: boolean;
    isStopRequested?: boolean;
    isClearRequested?: boolean;
    isPaused?: boolean;
    isEditing?: boolean;
    isPlaying?: boolean;
    isExpanded?: boolean;
    offsetChanged?: boolean;
    queueChanged?: boolean;
}

export abstract class AbstractMusic {
    private options: MusicActivityOptions;

    constructor(options?: MusicActivityOptions) {
        this.options = options ? options : {};
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

    get offsetChanged(): boolean {
        return this.options.offsetChanged ? this.options.offsetChanged : false;
    }

    set offsetChanged(value: boolean) {
        this.options.offsetChanged = value;
    }

    get queueChanged(): boolean {
        return this.options.queueChanged ? this.options.queueChanged : false;
    }

    set queueChanged(value: boolean) {
        this.options.queueChanged = value;
    }
}
