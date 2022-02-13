import { Music } from './music';

export class MusicUpdater {
    private music: Music;
    private shouldUpdate: boolean;
    private timer: number;
    private startedTimer: boolean;
    private interval: number;

    constructor(music: Music) {
        this.shouldUpdate = false;
        this.timer = 0;
        this.music = music;
        this.startedTimer = true;
        this.interval = 2500;
        this.updateTimer();
        this.updateQueue();
    }

    get time(): number {
        return this.timer;
    }

    public needsUpdate(): void {
        this.shouldUpdate = true;
    }

    public resetTimer(): void {
        this.startedTimer = true;
        this.timer = 0;
    }

    private updateTimer(): void {
        setTimeout(() => {
            try {
                if (this.startedTimer) {
                    this.startedTimer = false;
                } else if (!this.music.paused) {
                    this.timer += 1;
                }
                this.updateTimer();
            } catch (error) {
                console.error('Error in update timer: ', error);
            }
        }, 1000);
    }

    private updateQueue(): void {
        setTimeout(() => {
            try {
                if (this.shouldUpdate || this.music.playing) {
                    this.music.actions.updateQueueMessage();
                    this.shouldUpdate = false;
                }
                this.updateQueue();
            } catch (error) {
                console.error('Error in  update queue: ', error);
            }
        }, this.interval);
    }
}
