import { URL } from 'url';
import * as ytdl from 'ytdl-core';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ytSearch = require('yt-search');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ytpl = require('ytpl');

export class Song {
    // should be only initialized from find static method
    private songName: string;
    private songUrl: URL;
    private durationString: string;

    constructor(songName: string, durationString: string, songUrl: URL) {
        this.songName = songName;
        this.durationString = durationString;
        this.songUrl = songUrl;
    }

    get name(): string {
        return this.songName;
    }

    get duration(): string {
        return this.durationString;
    }

    get url(): URL {
        return this.songUrl;
    }

    public toString(): string {
        let name: string = this.songName;
        if (name.length > 45) name = name.substring(0, 40) + '...';
        name += `,\u3000Duration: **${this.durationString}**`;
        return name;
    }

    public static async find(nameOrUrl: string): Promise<Song[] | null> {
        try {
            const playlist: {
                [key: string]: { [key: string]: string }[];
            } = await ytpl(nameOrUrl);
            if (playlist && playlist.items && playlist.items.length > 0) {
                return playlist.items.map((p: { [key: string]: string }) => {
                    return new Song(p.title, p.duration, new URL(p.url));
                });
            }
            return null;
        } catch (e) {
            try {
                if (ytdl.validateURL(nameOrUrl)) {
                    const songInfo: ytdl.videoInfo = await ytdl.getInfo(
                        nameOrUrl,
                    );
                    const timestamp: string = Song.secondsToTimestamp(
                        Number(songInfo.videoDetails.lengthSeconds),
                    );
                    return [
                        new Song(
                            songInfo.videoDetails.title,
                            timestamp,
                            new URL(songInfo.videoDetails.video_url),
                        ),
                    ];
                } else {
                    const videoFinder = async (
                        query: string,
                    ): Promise<{ [key: string]: string }> => {
                        const videResult = await ytSearch(query);
                        return videResult.videos.length > 1
                            ? videResult.videos[0]
                            : null;
                    };
                    const video: { [key: string]: string } = await videoFinder(
                        nameOrUrl,
                    );
                    if (video) {
                        return [
                            new Song(
                                video.title,
                                video.timestamp,
                                new URL(video.url),
                            ),
                        ];
                    }
                    return null;
                }
            } catch (e2) {
                return null;
            }
        }
    }

    private static secondsToTimestamp(lengthSeconds: number): string {
        const hours: number = Math.floor(lengthSeconds / 3600);
        const minutes: number = Math.floor((lengthSeconds % 3600) / 60);
        const seconds: number = (lengthSeconds % 3600) % 60;
        const secondsString: string =
            seconds >= 10 ? seconds.toString() : '0' + seconds.toString();
        const minutesString: string =
            hours > 0 && minutes < 10
                ? '0' + minutes.toString()
                : minutes.toString();
        return hours > 0
            ? `${hours}:${minutesString}:${secondsString}`
            : `${minutesString}:${secondsString}`;
    }
}
