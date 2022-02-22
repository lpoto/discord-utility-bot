import { AudioResource, createAudioResource } from '@discordjs/voice';
import {
    BaseEntity,
    Column,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import ytdl from 'ytdl-core';
import ytpl from 'ytpl';
import * as yt from 'youtube-search-without-api-key';
import { Queue } from './queue';

@Entity('song')
export class Song extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    readonly id: string;

    @Column({ nullable: false })
    url: string;

    @Column({ nullable: false })
    name: string;

    @Column({ nullable: false })
    durationSeconds: number;

    @Column({ nullable: false })
    durationString: string;

    @Column({ nullable: false })
    position: number;

    @ManyToOne(() => Queue, (queue) => queue.songs, {
        onDelete: 'CASCADE',
        nullable: false,
        orphanedRowAction: 'delete',
    })
    queue: Queue;

    public toStringShortened(expanded?: boolean): string {
        const name: string = this.name;
        if (!expanded && name.length > 46)
            return name.substring(0, 43) + '...';
        if (expanded)
            return this.toString(`,\u3000**${this.durationString}**`);
        return this.toString();
    }

    public toString(add?: string): string {
        const name: string = add ? this.name + add : this.name;
        if (name.length < 47) return name;
        return name.replace(
            /(?![^\n]{1,43}$)([^\n]{1,43})\s/g,
            '$1\n\u3000\u3000',
        );
    }

    public static async findOnYoutube(
        nameOrUrl: string,
        position: number,
    ): Promise<Song[] | null> {
        if (Song.isYoutubeUrl(nameOrUrl))
            return Song.findByUrl(nameOrUrl, position);
        return Song.findBySearch(nameOrUrl, position);
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

    private static async findByUrl(
        url: string,
        position: number,
    ): Promise<Song[] | null> {
        if (!url) return null;
        return ytpl(url)
            .then((playlist) => {
                if (playlist && playlist.items && playlist.items.length > 0) {
                    return playlist.items.map((p, index) => {
                        return Song.create({
                            name: p.title,
                            url: p.url,
                            position: position + index,
                            durationSeconds: Number(p.durationSec),
                            durationString: this.secondsToTimeString(
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
                            this.create({
                                name: result.videoDetails.title,
                                url: result.videoDetails.video_url,
                                position: position,
                                durationSeconds: Number(
                                    result.videoDetails.lengthSeconds,
                                ),
                                durationString: this.secondsToTimeString(
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

    private static async findBySearch(
        query: string,
        position: number,
    ): Promise<Song[] | null> {
        if (!query) return null;
        return yt
            .search(query)
            .then(async (results) => {
                if (!results || results.length < 1) return null;
                return [
                    this.create({
                        name: results[0].snippet.title,
                        url: results[0].url,
                        position: position,
                        durationString: results[0].duration_raw,
                        durationSeconds: Song.durationStringToSeconds(
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

    private static isYoutubeUrl(url: string): boolean {
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
            hours === 0 || minutes < 10
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
