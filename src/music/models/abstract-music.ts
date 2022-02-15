export interface MusicActivityOptions {
    isLoop?: boolean;
    isLoopQueue?: boolean;
    isStopRequested?: boolean;
    isClearRequested?: boolean;
    isEditing?: boolean;
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

    get editing(): boolean {
        return this.options.isEditing ? this.options.isEditing : false;
    }

    set editing(value: boolean) {
        this.options.isEditing = value;
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
