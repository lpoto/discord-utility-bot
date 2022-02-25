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
        const spacer: string = '\n> \u3000\u2000\u2000';
        const songs: string[] | undefined = this.queue.songs.map(
            (song, index) => {
                if (index > 0)
                    return `***${index}.***\u3000*${song.toStringShortened(
                        this.queue.options.includes('expanded'),
                    )}*`;
                return `${song.toString(undefined, 38, spacer)}`;
            },
        );
        let headSong: string | undefined = songs.shift();
        if (!headSong) return;
        const addEmpty: boolean = headSong.split('\n').length - 1 === 0;
        const duration: string = queue.songs[0].durationString;
        headSong = `${spacer}\n**${duration}**\u3000\u2000${headSong}`
        if (addEmpty) headSong += `\n> ㅤ`

        // this.setDescription(this.buildDescription());
        this.addField(
            this.client.translate(this.queue.guildId, [
                'music',
                'queue',
                'curPlaying',
            ]),
            '\u2000' + headSong,
            false,
        );
        const queueSize: number = queue.songs.length;
        const sngs: string = songs.slice(this.queue.offset, this.queue.offset + QueueEmbed.songsPerPage()).join('\n')
        if (queueSize > 1) {
            this.addField(
                this.client.translate(this.queue.guildId, [
                    'music',
                    'queue',
                    'next',
                ]),
                sngs.length > 0 ? sngs : '-'
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
