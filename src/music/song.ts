import { URL } from 'url';

export class Song {
    // should be only initialized from find static method
    private songName: string;
    private songUrl: URL;
    private durationTime: number;

    constructor(songName: string, durationTime: number, songUrl: URL) {
        this.songName = songName;
        this.durationTime = durationTime;
        this.songUrl = songUrl;
    }

    get name(): string {
        return this.songName;
    }

    get duration(): number {
        return this.durationTime;
    }

    get url(): URL {
        return this.songUrl;
    }

    public static find(nameOrUrl: string): Song[] | null {
        // search youtube for either a song or multiple songs
        // if playlist given
        return [
            new Song(nameOrUrl, 10, new URL('https://www.valentinog.com')),
        ];
    }
}
