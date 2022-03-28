import { MessageEmbed } from 'discord.js';
import { MusicClient } from '../client';
import { Queue, Song, QueueOption } from '../entities';
import { QueueEmbedOptions } from '../../';
import { SongFinder } from './song-finder';
import { CustomAudioPlayer } from './custom-audio-player';

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
        });
        this.queue = options.queue;
        this.client = options.client;

        if (!this.queue.headSong) return;

        if (this.queue.headSong.color)
            this.setColor(this.queue.headSong.color);

        const queueSongs: Song[] = this.queue.curPageSongs;

        // if queue does not have expanded option, make songs shorter
        const songs: string[] | undefined = queueSongs.map((song, index) => {
            return `***${index + this.queue.offset + 1}.***\u3000${
                this.queue.hasOption(QueueOption.Options.EXPANDED)
                    ? this.toString(song)
                    : song.shortName
                    ? song.shortName
                    : song.name
            }`;
        });
        // show full head song name but wrapp it
        let headSong = this.wrap(this.queue.headSong);

        const duration: string = this.queue.headSong.durationString;

        const loader: string = this.getSongLoader();
        if (loader !== '') headSong = `> \u3000${headSong}\n> \n> ${loader}`;
        else headSong = `**${duration}**\u3000${headSong}\n> ㅤ`;
        headSong = `> \n${headSong}`;

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
            if (queueSize > 11 && songs.length < 10)
                sngs += '\n> '.repeat(10 - songs.length);
            sngs += `\n> \n> ${'\u3000'.repeat(3)}${this.client.translate(
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

    private toString(song: Song): string {
        let name: string = song.name;
        const d = `\u3000*${song.durationString}*`;
        if (name.length + d.length > 100)
            name = name.substring(0, 100 - d.length);
        return name + d;
    }

    private wrap(song: Song): string {
        let name: string = song.name;
        const lineLength = 30;
        const split = '\n> ㅤ';

        if (name.length > 100) name = name.substring(0, 100);
        const re = new RegExp(
            `(?![^\n]{1,${lineLength}}$)([^\n]{1,${lineLength}})\\s`,
            'g',
        );
        name = name.replace(re, `$1${split}`);
        const nameList: string[] = name.split(split);
        for (let i = 0; i < nameList.length; i++) {
            const dif: number = Math.round(
                (lineLength - nameList[i].length) / 3,
            );
            if (dif > 0) nameList[i] = '\u2000'.repeat(dif) + nameList[i];
        }
        return nameList.join(split);
    }

    private getSongLoader(): string {
        const audioPlayer: CustomAudioPlayer | null =
            this.client.getAudioPlayer(this.queue.guildId);
        if (
            !this.queue.headSong ||
            this.queue.headSong.durationSeconds < 10 ||
            !audioPlayer ||
            (!audioPlayer.playing && !audioPlayer.paused)
        )
            return '';
        const t1: number = audioPlayer.playbackDuration;
        const t2: number = this.queue.headSong?.durationSeconds;
        const s1: string = SongFinder.secondsToTimeString(t1);
        const s2: string = SongFinder.secondsToTimeString(t2);
        let n = 15;
        if (s1.length + s2.length > 9)
            n -= Math.floor((s1.length + s2.length - 9) / 2);
        if (n < 10) n = 10;
        let loader = `**${s1}**\u3000`;
        const x: number = Math.round((t1 * n) / t2);
        const y: number = Math.floor((n - x) / 2);
        if (x > 0) loader += '━'.repeat(x);
        loader += '•';
        if (y > 0) loader += '\u2000·\u2000'.repeat(y);
        if ((n - x) / 2 > y) loader += ' ·';
        loader += `\u3000**${s2}**`;
        return loader;
    }
}
