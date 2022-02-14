import { randomUUID } from 'crypto';
import { MessageActionRow, MessageButton, MessageEmbed } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { Music } from '../music';
import { Song } from './song';

export class QueueEmbed extends MessageEmbed {
    private music: Music;
    private songsPerSinglePage: number;

    constructor(music: Music) {
        super({
            title: music.translate(['music', 'queue', 'title']),
            footer: { text: music.translate(['music', 'queue', 'footer']) },
        });
        this.songsPerSinglePage = QueueEmbed.songsPerPage();
        this.music = music;
        this.setDescription(this.buildDescription());
        const queueSize: number = music.queue ? music.queue.size : 0;
        this.setDescription(
            `${this.description}\n\n${this.music.translate([
                'music',
                'queue',
                'songNumber',
            ])} ***${queueSize.toString()}***`,
        );
    }

    get songsOffset() {
        return this.music.queueOffset;
    }

    public getActionRow(): MessageActionRow {
        return new MessageActionRow().addComponents([
            new MessageButton()
                .setDisabled(this.songsOffset === 0)
                .setLabel(QueueEmbed.actionRowLabels(this.music).pageBackward)
                .setStyle(MessageButtonStyles.SECONDARY)
                .setCustomId(randomUUID()),
            new MessageButton()
                .setDisabled(
                    !this.music.queue ||
                        this.songsOffset + this.songsPerSinglePage >=
                            this.music.queue.size - 1,
                )
                .setLabel(QueueEmbed.actionRowLabels(this.music).pageForward)
                .setStyle(MessageButtonStyles.SECONDARY)
                .setCustomId(randomUUID()),
            new MessageButton()
                .setDisabled(!this.music.queue || this.music.queue.size === 0)
                .setLabel(QueueEmbed.actionRowLabels(this.music).loop)
                .setStyle(
                    this.music && this.music.loop
                        ? MessageButtonStyles.SUCCESS
                        : MessageButtonStyles.SECONDARY,
                )
                .setCustomId(randomUUID()),
            new MessageButton()
                .setDisabled(!this.music.queue || this.music.queue.size === 0)
                .setLabel(QueueEmbed.actionRowLabels(this.music).loopQueue)
                .setStyle(
                    this.music && this.music.loopQueue
                        ? MessageButtonStyles.SUCCESS
                        : MessageButtonStyles.SECONDARY,
                )
                .setCustomId(randomUUID()),
        ]);
    }

    private buildDescription(): string {
        try {
            const songs: string[] | undefined = this.music.queue?.allSongs.map(
                (song, index) => {
                    if (index > 0)
                        return `***${index}.***\u3000${song.toStringShortened(
                            this.music.expanded,
                        )}`;
                    return song.toStringWrapped50();
                },
            );
            if (!songs || songs.length < 1) return '';
            let headSong: string | undefined = songs.shift();
            if (!headSong) headSong = '';
            const spacer = '\u3000';
            let description: string =
                songs.length === 0
                    ? ''
                    : songs
                          .slice(
                              this.songsOffset,
                              this.songsOffset + QueueEmbed.songsPerPage(),
                          )
                          .join('\n');
            description += `\n\n**${this.music.translate([
                'music',
                'queue',
                'curPlaying',
            ])}**`;
            description +=
                spacer + headSong + '\n\n' + spacer + this.songLoader();
            return description;
        } catch (e) {
            console.error('Queue embed error: ', e);
            return '';
        }
    }

    public static actionRowLabels(music: Music): {
        [key in 'pageForward' | 'pageBackward' | 'loop' | 'loopQueue']: string;
    } {
        return {
            pageForward: music.translate([
                'music',
                'actionRow',
                'pageForward',
            ]),
            pageBackward: music.translate([
                'music',
                'actionRow',
                'pageBackward',
            ]),
            loop: music.translate(['music', 'actionRow', 'loop']),
            loopQueue: music.translate(['music', 'actionRow', 'loopQueue']),
        };
    }

    private songLoader(): string {
        if (!this.music.queue) return '';
        try {
            const song: Song | null = this.music.queue?.head;
            if (!song) return '';
            let leftTime: string = this.secondsToTimeString(
                this.music.actions.time,
            );
            let rightTime: string = this.secondsToTimeString(song.seconds);
            let steps = 15;
            if ((leftTime + rightTime).length > 7) steps = 14;
            leftTime = `***${leftTime}***`;
            rightTime = `***${rightTime}***`;
            const x: number = Math.round(
                (this.music.actions.time /
                    (song.seconds > 0 ? song.seconds : 1)) *
                    steps,
            );
            leftTime += '\u2000';
            if (x > 1) {
                leftTime += '—'.repeat(x - 1);
            }
            leftTime += '●';
            steps = x === 0 ? steps - 1 : steps;
            if (steps - x > 0) leftTime += '\u2000 ·'.repeat(steps - x);
            return `${leftTime}\u2000${rightTime}`;
        } catch (e) {
            console.error('Song loader error: ', e);
            return '';
        }
    }

    private secondsToTimeString(seconds: number) {
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

    public static songsPerPage(): number {
        return 10;
    }
}
