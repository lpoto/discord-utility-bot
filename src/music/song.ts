import { Url } from 'url';

export class Song {
    // should be only initialized from find static method
    private songName: string;
    private songUrl: Url;
    private durationTime: number;

    constructor(songName: string, durationTime: number, songUrl: Url) {
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

    get url(): Url {
        return this.songUrl;
    }

    public static find(nameOrUrl: string): Song[] | null {
        console.log(nameOrUrl);
        // search youtube for either a song or multiple songs
        // if playlist given
        return null;
    }
}
