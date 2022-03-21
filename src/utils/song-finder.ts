import { AudioResource, createAudioResource } from '@discordjs/voice';
import ytdl from 'ytdl-core';
import ytpl from 'ytpl';
import * as yt from 'youtube-search-without-api-key';
import { Song } from '../entities';

export class SongFinder {
    private songs: Promise<Song[] | null>;

    public constructor(nameOrUrl: string) {
        this.songs = this.findOnYoutube(nameOrUrl);
    }

    public async getSongs(): Promise<Song[] | null> {
        return this.songs;
    }

    public static async getResource(
        song: Song,
    ): Promise<AudioResource | null> {
        return createAudioResource(
            ytdl(song.url, {
                filter: 'audioonly',
                highWaterMark: 1 << 25,
                quality: 'highestaudio',
            }),
        );
    }

    private async findOnYoutube(nameOrUrl: string): Promise<Song[] | null> {
        if (this.isYoutubeUrl(nameOrUrl)) return this.findByUrl(nameOrUrl);
        return this.findBySearch(nameOrUrl);
    }

    private async findByUrl(url: string): Promise<Song[] | null> {
        if (!url) return null;
        return ytpl(url)
            .then((playlist) => {
                if (playlist && playlist.items && playlist.items.length > 0) {
                    return playlist.items.map((p) => {
                        return Song.create({
                            name: p.title,
                            url: p.url,
                            durationSeconds: Number(p.durationSec),
                            durationString: SongFinder.secondsToTimeString(
                                Number(p.durationSec),
                            ),
                        });
                    });
                }
                return null;
            })
            .catch(async () => {
                return ytdl
                    .getInfo(url)
                    .then((result) => {
                        return [
                            Song.create({
                                name: result.videoDetails.title,
                                url: result.videoDetails.video_url,
                                durationSeconds: Number(
                                    result.videoDetails.lengthSeconds,
                                ),
                                durationString: SongFinder.secondsToTimeString(
                                    Number(result.videoDetails.lengthSeconds),
                                ),
                            }),
                        ];
                    })
                    .catch(() => {
                        console.log('no videos found');
                        return null;
                    });
            });
    }

    private async findBySearch(query: string): Promise<Song[] | null> {
        if (!query) return null;
        return yt
            .search(query)
            .then(async (results) => {
                if (!results || results.length < 1) return null;
                return [
                    Song.create({
                        name: results[0].snippet.title,
                        url: results[0].url,
                        durationString: results[0].duration_raw,
                        durationSeconds: SongFinder.durationStringToSeconds(
                            results[0].duration_raw,
                        ),
                    }),
                ];
            })
            .catch((e) => {
                console.log('no search results found', e);
                return null;
            });
    }

    private isYoutubeUrl(url: string): boolean {
        if (!url) return false;
        // eslint-disable-next-line max-len
        const regExp =
            /^https?:\/\/(?:www\.youtube(?:-nocookie)?\.com\/|m\.youtube\.com\/|youtube\.com\/)/i;
        const match: RegExpMatchArray | null = url.match(regExp);
        return match !== null && match !== undefined;
    }

    private static durationStringToSeconds(duration: string): number {
        if (!duration) return 0;
        const hms: number[] = duration.split(':').map((t) => Number(t));
        if (hms.length === 3) return hms[0] * 3600 + hms[1] * 60 + hms[2];
        else if (hms.length === 2) return hms[0] * 60 + hms[1];
        else if (hms.length === 1) return hms[0];
        return 0;
    }

    public static secondsToTimeString(seconds: number) {
        const hours: number = Math.floor(seconds / 3600);
        const minutes: number = Math.floor((seconds % 3600) / 60);
        const newSeconds: number = (seconds % 3600) % 60;
        const minutesString: string =
            hours === 0 || minutes >= 10
                ? minutes.toString()
                : '0' + minutes.toString();
        const secondsString: string =
            newSeconds < 10
                ? '0' + newSeconds.toString()
                : newSeconds.toString();
        return hours > 0
            ? `${hours}:${minutesString}:${secondsString}`
            : `${minutesString}:${secondsString}`;
    }
}
