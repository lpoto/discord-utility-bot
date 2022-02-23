import { MessageEmbed } from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';

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
            description: '',
            color: queue.color,
        });
        this.queue = queue;
        this.client = client;
        const songs: string[] | undefined = this.queue.songs.map(
            (song, index) => {
                if (index > 0)
                    return `***${index}.***\u3000*${song.toStringShortened(
                        this.queue.options.includes('expanded'),
                    )}*`;
                return `*${song.toString(undefined, 1)}*`;
            },
        );
        const headSong: string | undefined = songs.shift();
        if (!headSong) return;
        const duration: string = queue.songs[0].durationString;

        // this.setDescription(this.buildDescription());
        this.setFields([
            {
                name: this.client.translate(this.queue.guildId, [
                    'music',
                    'queue',
                    'curPlaying',
                ]),
                value: '\u2000' + headSong,
                inline: true,
            },
            {
                name: this.client.translate(this.queue.guildId, [
                    'music',
                    'queue',
                    'duration',
                ]),
                value: `***${duration}***`,
                inline: true,
            },
        ]);
        const queueSize: number = queue.songs.length;
        if (queueSize > 1) {
            this.addField(
                this.client.translate(this.queue.guildId, [
                    'music',
                    'queue',
                    'next',
                ]),
                songs
                    .slice(
                        this.queue.offset,
                        this.queue.offset + QueueEmbed.songsPerPage(),
                    )
                    .join('\n'),
            );
            this.addField(
                this.client.translate(this.queue.guildId, [
                    'music',
                    'queue',
                    'songNumber',
                ]),
                `***${queueSize - 1}***`,
            );
        }
    }

    get songsOffset() {
        return this.queue.offset;
    }

    public static songsPerPage(): number {
        return 10;
    }
}
