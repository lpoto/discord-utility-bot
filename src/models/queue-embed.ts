import { MessageEmbed } from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';

export class QueueEmbed extends MessageEmbed {
    private queue: Queue;
    private client: MusicClient;

    constructor(
        client: MusicClient,
        queue: Queue,
        clientRestart?: boolean,
        innactivity?: boolean,
    ) {
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
            description: !clientRestart
                ? !innactivity
                    ? ''
                    : client.translate(queue.guildId, [
                          'innactivityDisconnect',
                      ])
                : client.translate(queue.guildId, ['clientRestarted']),
            color: queue.color,
        });
        this.queue = queue;
        this.client = client;

        const spacer = '\n> \u3000\u2000\u2000';

        if (this.queue.songs.length < 1) return;

        const songs: string[] | undefined = this.queue.songs
            .slice(1)
            .slice(
                this.queue.offset,
                this.queue.offset + QueueEmbed.songsPerPage(),
            )
            .map((song, index) => {
                return `***${
                    index + this.queue.offset + 1
                }.***\u3000*${song.toStringShortened(
                    this.queue.options.includes('expanded'),
                )}*`;
            });
        let headSong = `*${this.queue.songs[0].toString(
            undefined,
            36,
            spacer,
        )}*`;
        const addEmpty: boolean = headSong.split('\n').length - 1 === 0;
        const duration: string = queue.songs[0].durationString;
        headSong = `${spacer}\n**${duration}**\u3000\u2000${headSong}`;
        if (addEmpty) headSong += '\n> ㅤ';

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
        if (queueSize > 1) {
            let sngs: string = songs.join('\n');
            sngs += `\n> \n> ${'\u3000'.repeat(5)}${this.client.translate(
                this.queue.guildId,
                ['music', 'queue', 'songNumber'],
            )}:\u3000***${queueSize - 1}***`;
            this.addField(
                this.client.translate(this.queue.guildId, [
                    'music',
                    'queue',
                    'next',
                ]),
                sngs.length > 0
                    ? sngs.length > 1024
                        ? sngs.substring(0, 1024)
                        : sngs
                    : '-',
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
