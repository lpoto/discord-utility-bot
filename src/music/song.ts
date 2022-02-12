import { AudioResource, createAudioResource } from '@discordjs/voice';
import ytdl from 'ytdl-core';
import ytpl from 'ytpl';
import * as yt from 'youtube-search-without-api-key';

export class Song {
    // should be only initialized from find static method
    private songName: string;
    private url: string;

    constructor(songName: string, url: string) {
        this.songName = songName;
        this.url = url;
    }

    get name(): string {
        return this.songName;
    }

    public toString(): string {
        let name: string = this.songName.replace('&#39;', '`');
        if (name.length > 55) name = name.substring(0, 52) + '...';
        return name;
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
                quality: 'lowest',
            }),
        );
    }

    private static async findByUrl(url: string): Promise<Song[] | null> {
        return ytpl(url)
            .then((playlist) => {
                if (playlist && playlist.items && playlist.items.length > 0) {
                    return playlist.items.map((p) => {
                        return new Song(p.title, p.url);
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
                return [new Song(results[0].snippet.title, results[0].url)];
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
}
