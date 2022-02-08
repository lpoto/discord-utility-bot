import { Song } from './song';

export class SongQueue {
    private songs: Song[] = [];

    get size() {
        return this.songs.length;
    }

    get totalDuration(): number {
        if (!this.songs) this.songs = [];
        return this.songs.reduce((sum, song) => sum + song.duration, 0);
    }

    get songNames(): string[] {
        if (!this.songs) this.songs = [];
        return this.songs.map((song) => {
            return song.name;
        });
    }

    public enqueue(nameOrUrl: string) {
        if (!this.songs) this.songs = [];
        const songs: Song[] | null = Song.find(nameOrUrl);
        if (!songs) return;
        for (const song of songs) this.songs.push(song);
    }

    public enqueueFront(nameOrUrl: string) {
        if (!this.songs) this.songs = [];
        const songs: Song[] | null = Song.find(nameOrUrl);
        if (!songs) return;
        for (const song of songs) this.songs.unshift(song);
    }

    public dequeue(): Song | null {
        if (!this.songs || this.size < 1) return null;
        const song: Song | undefined = this.songs.shift();
        return song ? song : null;
    }

    public shuffle(): void {
        for (let i = this.size - 1; i >= 0; i--) {
            const randomIndex = Math.floor(Math.random() * i);
            [this.songs[i], this.songs[randomIndex]] = [
                this.songs[randomIndex],
                this.songs[i],
            ];
        }
    }

    public removeByName(songName: string): void {
        if (!this.songs) this.songs = [];
        const songIndex = this.songs.findIndex(
            (song) => song.name === songName,
        );
        if (songIndex !== -1) this.removeByIndex(songIndex);
    }

    public removeByIndex(songIndex: number): void {
        if (!this.songs) this.songs = [];
        if (this.size <= songIndex || songIndex < 0) return;
        this.songs.splice(songIndex, 1);
    }
}
