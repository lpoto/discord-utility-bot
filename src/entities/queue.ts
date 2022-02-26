import {
    AfterLoad,
    BaseEntity,
    Column,
    Entity,
    OneToMany,
    PrimaryColumn,
} from 'typeorm';
import { QueueEmbed } from '../models';
import { Song } from './song';

@Entity('queue')
export class Queue extends BaseEntity {
    @PrimaryColumn()
    clientId: string;

    @PrimaryColumn()
    guildId: string;

    @Column({ nullable: false })
    channelId: string;

    @Column({ nullable: false })
    messageId: string;

    @Column({ nullable: false })
    threadId: string;

    @Column({ nullable: false })
    offset: number;

    @Column({ nullable: false })
    color: number;

    @Column('text', { array: true })
    options: string[];

    @OneToMany(() => Song, (song) => song.queue, {
        cascade: ['insert', 'update', 'remove'],
        orphanedRowAction: 'delete',
        eager: true,
    })
    songs: Song[];

    @AfterLoad()
    sortSongs(): void {
        if (this.songs) this.songs.sort((s1, s2) => s1.position - s2.position);
        if (this.offset && this.songs)
            while (this.offset >= this.songs.length - 1)
                this.offset -= QueueEmbed.songsPerPage();
        if (this.offset < 0) this.offset = 0;
    }
}
