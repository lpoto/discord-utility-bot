import { MessageEmbed } from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { Song } from '../entities';

export class QueueEmbed extends MessageEmbed {
    private queue: Queue;
    private client: MusicClient;

    constructor(client: MusicClient, queue: Queue) {
        super({
            title: client.translate(queue.guildId, [
                'music',
                'queue',
                'title',
            ]),
            footer: {
                text: client.translate(queue.guildId, [
                    'music',
                    'queue',
                    'footer',
                ]),
            },
            color: queue.color,
        });
        this.queue = queue;
        this.client = client;

        this.setDescription(this.buildDescription());
        const queueSize: number = queue.songs.length;
        this.setDescription(
            `${this.description}\n\n${this.client.translate(queue.guildId, [
                'music',
                'queue',
                'songNumber',
            ])} ***${queueSize.toString()}***`,
        );
    }

    get songsOffset() {
        return this.queue.offset;
    }

    private buildDescription(): string {
        try {
            const songs: string[] | undefined = this.queue.songs.map(
                (song, index) => {
                    if (index > 0)
                        return `***${index}.***\u3000${song.toStringShortened(
                            this.queue.options.includes('expanded'),
                        )}`;
                    return song.toString();
                },
            );
            if (!songs || songs.length < 1) return '';
            let headSong: string | undefined = songs.shift();
            if (!headSong) headSong = '';
            const spacer = '\u3000';
            let description = `**${this.client.translate(this.queue.guildId, [
                'music',
                'queue',
                'curPlaying',
            ])}**`;
            description +=
                spacer + headSong + '\n\n' + spacer + this.durationString();
            if (songs.length > 0) {
                description +=
                    '\n\n' +
                    songs
                        .slice(
                            this.queue.offset,
                            this.queue.offset + QueueEmbed.songsPerPage(),
                        )
                        .join('\n');
            }
            return description;
        } catch (e) {
            console.error('Queue embed error: ', e);
            return '';
        }
    }

    private durationString(): string {
        if (this.queue.songs.length === 0) return '';
        const song: Song = this.queue.songs[0];
        if (!song) return '';
        return `${this.client.translate(this.queue.guildId, [
            'music',
            'queue',
            'duration',
        ])}: **${Song.secondsToTimeString(song.durationSeconds)}**`;
    }

    public static songsPerPage(): number {
        return 10;
    }
}
