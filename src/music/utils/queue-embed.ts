import { randomUUID } from 'crypto';
import { MessageActionRow, MessageButton, MessageEmbed } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { Music } from '../music';

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
            ])} **${queueSize.toString()}**`,
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
            new MessageButton()
                .setDisabled(!this.music.queue || this.music.queue.size < 2)
                .setLabel(QueueEmbed.actionRowLabels(this.music).shuffle)
                .setStyle(MessageButtonStyles.SECONDARY)
                .setCustomId(randomUUID()),
        ]);
    }

    private buildDescription(): string {
        const songs: string[] | undefined = this.music.queue?.allSongs.map(
            (song, index) => {
                if (index > 0) return `**${index}.**\u3000${song.toString()}`
                return song.toString();
            },
        );
        if (!songs || songs.length < 1) return '';
        const headSong = songs.shift();
        return (
            (songs.length == 0
                ? ''
                : songs
                      .slice(
                          this.songsOffset,
                          this.songsOffset + QueueEmbed.songsPerPage(),
                      )
                      .join('\n')) +
            `\n\n**${this.music.translate([
                'music',
                'queue',
                'curPlaying',
            ])}**\n\u3000\u2000${headSong}`
        );
    }

    public static actionRowLabels(
        music: Music,
    ): {
        [key in
            | 'pageForward'
            | 'pageBackward'
            | 'loop'
            | 'loopQueue'
            | 'shuffle']: string;
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
            shuffle: music.translate(['music', 'actionRow', 'shuffle']),
        };
    }
    public static songsPerPage(): number {
        return 10;
    }
}
