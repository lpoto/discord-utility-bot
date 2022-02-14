import { AudioResource, createAudioResource } from '@discordjs/voice';
import ytdl from 'ytdl-core';
import ytpl from 'ytpl';
import * as yt from 'youtube-search-without-api-key';

export class Song {
    // should be only initialized from find static method
    private songName: string;
    private timeInSeconds: number;
    private url: string;

    constructor(songName: string, url: string, timeInSeconds: number) {
        this.songName = songName;
        this.url = url;
        this.timeInSeconds = timeInSeconds;
    }

    get name(): string {
        return this.songName;
    }

    get seconds(): number {
        return this.timeInSeconds;
    }

    public toString(): string {
        let name: string = this.songName;
        if (name.length > 55) name = name.substring(0, 52) + '...';
        return name;
    }

    public toStringShortened(expanded?: boolean): string {
        const name: string = this.songName;
        if (!expanded && name.length > 46)
            return name.substring(0, 43) + '...';
        return this.toStringWrapped50();
    }

    public toStringWrapped50(): string {
        const name: string = this.songName;
        if (name.length < 47) return name;
        return name.replace(
            /(?![^\n]{1,43}$)([^\n]{1,43})\s/g,
            '$1\n\u3000\u3000',
        );
    }

    public static async find(nameOrUrl: string): Promise<Song[] | null> {
        if (Song.isYoutubeUrl(nameOrUrl)) return Song.findByUrl(nameOrUrl);
        return Song.findBySearch(nameOrUrl);
    }

    public async getResource(): Promise<AudioResource | null> {
        return createAudioResource(
            ytdl(this.url, {
                filter: 'audioonly',
                highWaterMark: 1 << 25,
                quality: 'highestaudio',
            }),
        );
    }

    private static async findByUrl(url: string): Promise<Song[] | null> {
        return ytpl(url)
            .then((playlist) => {
                if (playlist && playlist.items && playlist.items.length > 0) {
                    return playlist.items.map((p) => {
                        return new Song(p.title, p.url, Number(p.durationSec));
                    });
                }
                return null;
            })
            .catch(async () => {
                return ytdl
                    .getInfo(url)
                    .then((result) => {
                        return [
                            new Song(
                                result.videoDetails.title,
                                result.videoDetails.video_url,
                                Number(result.videoDetails.lengthSeconds),
                            ),
                        ];
                    })
                    .catch(() => {
                        console.log('no videos found');
                        return null;
                    });
            });
    }

    private static async findBySearch(query: string): Promise<Song[] | null> {
        return yt
            .search(query)
            .then(async (results) => {
                if (!results || results.length < 1) return null;
                return [
                    new Song(
                        results[0].snippet.title,
                        results[0].url,
                        Song.durationStringToSeconds(results[0].duration_raw),
                    ),
                ];
            })
            .catch((e) => {
                console.log('no search results found', e);
                return null;
            });
    }

    private static isYoutubeUrl(url: string): boolean {
        // eslint-disable-next-line max-len
        const regExp =
            /^https?:\/\/(?:www\.youtube(?:-nocookie)?\.com\/|m\.youtube\.com\/|youtube\.com\/)/i;
        const match: RegExpMatchArray | null = url.match(regExp);
        return match !== null && match !== undefined;
    }

    private static durationStringToSeconds(duration: string): number {
        const hms: number[] = duration.split(':').map((t) => Number(t));
        if (hms.length === 3) return hms[0] * 3600 + hms[1] * 60 + hms[2];
        else if (hms.length === 2) return hms[0] * 60 + hms[1];
        else if (hms.length === 1) return hms[0];
        return 0;
    }
}
