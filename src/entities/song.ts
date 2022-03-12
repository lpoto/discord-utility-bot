import {
    BaseEntity,
    BeforeInsert,
    Column,
    Entity,
    Index,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Queue } from './queue';

@Entity('song')
export class Song extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public readonly id: string;

    @Index()
    @Column({ nullable: false })
    public position: number;

    @Column({ nullable: false })
    public url: string;

    @Column({ nullable: false })
    public name: string;

    @Column({ nullable: false })
    public durationSeconds: number;

    @Column({ nullable: false })
    public durationString: string;

    @ManyToOne(() => Queue, (queue) => queue.curPageSongs, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        orphanedRowAction: 'delete',
        nullable: false,
    })
    public queue: Queue;

    @BeforeInsert()
    public async generatePosition(): Promise<void> {
        // auto increment position for current queue
        const position: number = await Song.createQueryBuilder('song')
            .select('MAX(song.position)', 'max')
            .where({ queue: this.queue })
            .getRawOne()
            .then((r) => {
                if (r && r.max !== undefined && r.max !== null)
                    return r.max + 1;
                return 0;
            });
        this.position = position;
    }

    public static async minPosition(): Promise<number> {
        return Song.createQueryBuilder('song')
            .select('MIN(song.position)', 'min')
            .getRawOne()
            .then((p) => {
                if (p && p.min !== undefined && p.min !== null) return p.min;
                return 0;
            });
    }
}
