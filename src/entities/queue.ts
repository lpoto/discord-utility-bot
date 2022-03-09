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
        lazy: true,
    })
    allSongs: Promise<Song[]>;

    headSong: Song | undefined;

    curPageSongs: Song[] = [];

    size = 0;

    @AfterLoad()
    async afterQueueLoad(): Promise<void> {
        this.size = await Song.count({ where: { queue: this } });
        await this.reloadCurPageSongs();
        this.headSong = await Song.createQueryBuilder('song')
            .where(
                'song.queue.guildId = :gId AND song.queue.clientId = :cId',
                {
                    gId: this.guildId,
                    cId: this.clientId,
                },
            )
            .orderBy('song.position', 'ASC')
            .getOne();
    }

    async maxPosition(): Promise<number> {
        return Song.createQueryBuilder('song')
            .orderBy('song.position', 'DESC')
            .getOne()
            .then((r) => {
                if (r) return r.position;
                return -1;
            });
    }

    async reloadCurPageSongs(): Promise<void> {
        this.curPageSongs = await Song.createQueryBuilder('song')
            .where(
                'song.queue.guildId = :gId AND song.queue.clientId = :cId',
                {
                    gId: this.guildId,
                    cId: this.clientId,
                },
            )
            .orderBy('song.position', 'ASC')
            .limit(QueueEmbed.songsPerPage())
            .offset(this.offset + 1)
            .getMany();
    }
}
