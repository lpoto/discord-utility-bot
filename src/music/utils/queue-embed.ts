import { randomUUID } from 'crypto';
import { MessageActionRow, MessageButton, MessageEmbed } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { Music } from '../music';

export class QueueEmbed extends MessageEmbed {
    private music: Music;
    private songsPerSinglePage: number;
    private songsOffset: number;

    constructor(music: Music, songsOffset: number = 0) {
        super({
            title: music.translate(['music', 'queue', 'title']),
            footer: { text: music.translate(['music', 'queue', 'footer']) },
        });
        this.songsPerSinglePage = QueueEmbed.songsPerPage();
        this.songsOffset =
            songsOffset - (songsOffset % this.songsPerSinglePage);
        this.music = music;
        this.setDescription(this.buildDescription());
        const queueSize: number = music.queue ? music.queue.size : 0;
        if (this.songsOffset >= queueSize) this.songsOffset = 0;
        this.setDescription(
            this.description +
                '\n\n' +
                this.music.translate(['music', 'queue', 'songNumber']) +
                queueSize.toString(),
        );
        if (queueSize > this.songsPerSinglePage)
            this.setDescription(
                this.description +
                    '\n' +
                    this.music.translate(['music', 'queue', 'page']) +
                    `${
                        this.songsOffset / this.songsPerSinglePage + 1
                    }/${Math.ceil(queueSize / this.songsPerSinglePage)}`,
            );
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
                            this.music.queue.size,
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
        return !this.music.queue
            ? ''
            : this.music.queue.songNames
                  .slice(this.songsOffset, this.songsOffset + 10)
                  .join('\n');
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

    public static songsPerPage(): number {
        return 10;
    }
}
