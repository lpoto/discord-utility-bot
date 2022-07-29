import ytdl from 'ytdl-core';
import ytpl from 'ytpl';
import * as yt from 'youtube-search-without-api-key';
import { Song } from '../entities';
import pixelWidth from 'string-pixel-width';
import { MusicClient } from '../client';

export class SongFinder {
    private songs: Promise<Song[] | null>;
    private client: MusicClient;

    public constructor(nameOrUrl: string, client: MusicClient) {
        this.songs = this.findOnYoutube(nameOrUrl);
        this.client = client;
    }

    public async getSongs(): Promise<Song[] | null> {
        return this.songs;
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
                    this.client.logger.debug(
                        `Found playlist with ${playlist.items.length} items for "${url}"`,
                    );
                    return playlist.items.map((p) => {
                        return this.newSong(
                            p.title,
                            p.url,
                            SongFinder.secondsToTimeString(
                                Number(p.durationSec),
                            ),
                            Number(p.durationSec),
                        );
                    });
                }
                return null;
            })
            .catch(async () => {
                return ytdl
                    .getInfo(url)
                    .then((result) => {
                        if (result.videoDetails)
                            this.client.logger.debug(
                                `Found a result by url ${url}`,
                            );

                        return [
                            this.newSong(
                                result.videoDetails.title,
                                result.videoDetails.video_url,
                                SongFinder.secondsToTimeString(
                                    Number(result.videoDetails.lengthSeconds),
                                ),
                                Number(result.videoDetails.lengthSeconds),
                            ),
                        ];
                    })
                    .catch(() => {
                        this.client.logger.debug(
                            `No videos found for "${url}"`,
                        );
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
                this.client.logger.debug(
                    `Found ${results.length} result/s for query "${query}"`,
                );
                return [
                    this.newSong(
                        results[0].snippet.title,
                        results[0].url,
                        results[0].duration_raw,
                        SongFinder.durationStringToSeconds(
                            results[0].duration_raw,
                        ),
                    ),
                ];
            })
            .catch((e: Error) => {
                this.client.logger.debug(
                    `No search result found for "${query}":`,
                    e.message,
                );
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

    private trimName(name: string): string {
        name = name.replace(
            /(-(\s+)?)?(\(|\[|\|).*?(lyric(s)?|text|tekst|of(f)?ici(j)?al(ni)?|video|film|audio|spot|hd|hq|\dk)((\s+)?(\d+)?)(\)|\]|\|)/gi,
            '',
        );
        name = name.replace(
            /(-(\s+))?((off?ici([^(spot)]|[^(video)])*(\s+)?(spot|video))|(h(d|q))|(\d+p)|(\dk))$/gim,
            '',
        );
        name = name.replace(
            /((\+)?(\s+)?(lyric(s)?|text|tekst))|(#(\w+)?(\s+)?)+$/gim,
            '',
        );
        name = name.replace(/(\/\/)(\/+)?/g, '-');
        name = name.replace(/(\|\|)(\|+)?/g, '-');
        name = name.replace(/\*/g, '\\*');
        name = name.replace(/_/g, '\\_');
        return name
            .split(/\s+/)
            .map((w) => {
                return (
                    w.charAt(0).toUpperCase() +
                    w.substring(1, w.length).toLowerCase()
                );
            })
            .join(' ');
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

    private newSong(
        title: string,
        url: string,
        time: string,
        seconds: number,
    ): Song {
        title = this.trimName(title);
        const song: Song = Song.create({
            name: title,
            url: url,
            durationSeconds: seconds,
            durationString: time,
            shortName: this.shorterTitle(title),
        });
        return song;
    }

    private shorterTitle(title: string): string | null {
        const n: number = title.length;
        while (
            pixelWidth(title, {
                size: 11,
                italic: false,
                bold: false,
                font: 'open sans',
            }) > 170
        ) {
            title = title.substring(0, title.length - 1);
        }
        if (title.length === n) return null;
        return title + '...';
    }
}
