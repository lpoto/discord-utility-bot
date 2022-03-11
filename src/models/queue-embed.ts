import { MessageEmbed } from 'discord.js';
import { MusicClient } from '../client';
import { Queue, Song } from '../entities';
import { QueueEmbedOptions } from '../../';
import { QueueOption } from '../entities/option';

export class QueueEmbed extends MessageEmbed {
    private queue: Queue;
    private client: MusicClient;

    public constructor(options: QueueEmbedOptions) {
        super({
            title: options.client.translate(options.queue.guildId, [
                'music',
                'queue',
                'title',
            ]),
            footer: {
                text: options.client.translate(options.queue.guildId, [
                    'music',
                    'queue',
                    'footer',
                ]),
            },
            description: !options.clientRestart
                ? !options.innactivity
                    ? ''
                    : options.client.translate(options.queue.guildId, [
                          'innactivityDisconnect',
                      ])
                : options.client.translate(options.queue.guildId, [
                      'clientRestarted',
                  ]),
            color: options.queue.color,
        });
        this.queue = options.queue;
        this.client = options.client;

        const spacer = '\n> \u3000\u2000\u2000';

        if (!this.queue.headSong) return;

        const queueSongs: Song[] = this.queue.curPageSongs;

        const songs: string[] | undefined = queueSongs.map((song, index) => {
            return `***${
                index + this.queue.offset + 1
            }.***\u3000*${song.toStringShortened(
                this.queue.hasOption(QueueOption.Options.EXPANDED),
            )}*`;
        });
        let headSong = `*${this.queue.headSong.toString(
            undefined,
            36,
            spacer,
        )}*`;
        const addEmpty: boolean = headSong.split('\n').length - 1 === 0;
        const duration: string = this.queue.headSong.durationString;
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
        const queueSize: number = options.queue.size;
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

    public get songsOffset() {
        return this.queue.offset;
    }

    public static songsPerPage(): number {
        return 10;
    }
}
