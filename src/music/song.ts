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

    public toString(): string {
        let name: string = this.songName;
        if (name.length > 45) name = name.substring(0, 40) + '...';
        name += `,\u3000Duration: ${this.durationString()}`;
        return name;
    }

    private durationString(): string {
        let hours = Math.floor(this.durationTime / 3600);
        let minutes = Math.floor((this.durationTime % 3600) / 60);
        let seconds = Math.floor((this.durationTime % 3600) % 60);
        let timestring = hours > 0 ? `${hours}h` : '';
        if (minutes > 0) {
            if (timestring.length > 0) timestring += `, ${minutes}min`;
            else timestring = `${minutes}min`;
        }
        if (seconds > 0) {
            if (timestring.length > 0) timestring += `, ${seconds}s`;
            else timestring = `${seconds}s`;
        }
        return '**' + (timestring.length > 0 ? timestring : '0') + '**';
    }

    public static find(nameOrUrl: string): Song[] | null {
        // search youtube for either a song or multiple songs
        // if playlist given
        return [
            new Song(
                nameOrUrl,
                Math.floor(Math.random() * 10000),
                new URL('https://www.valentinog.com'),
            ),
        ];
    }
}
