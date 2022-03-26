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
    public static lastClearedInactive: Date | undefined;
    public static persistSeconds: number = 60 * 60 * 2;

    @PrimaryGeneratedColumn('uuid')
    public readonly id: string;

    @Index()
    @Column({ nullable: false })
    public position: number;

    @Column('timestamp', {
        default: () => '((CURRENT_TIMESTAMP))',
    })
    public timestamp: Date;

    @Column({ nullable: false })
    public url: string;

    @Column({ nullable: false })
    public name: string;

    @Column({ nullable: false })
    public durationSeconds: number;

    @Column({ nullable: false })
    public color: number;

    @Column({ nullable: false })
    public durationString: string;

    @Index()
    @Column('boolean', { default: true, nullable: false })
    public active: boolean;

    @Index()
    @ManyToOne(() => Queue, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        orphanedRowAction: 'delete',
        nullable: false,
    })
    public queue: Queue;

    @ManyToOne(() => Song, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        orphanedRowAction: 'delete',
        lazy: true,
    })
    public getPrevious: Promise<Song>;

    public previous: Song | null;

    @BeforeInsert()
    public setColor(): void {
        this.color = Math.floor(Math.random() * 16777215);
    }

    public async generatePosition(): Promise<void> {
        // auto increment position for current queue
        const position: number = await Song.createQueryBuilder('song')
            .select('MAX(song.position)', 'max')
            .where({ queue: this.queue, active: true })
            .getRawOne()
            .then((r) => {
                if (r && r.max !== undefined && r.max !== null)
                    return r.max + 1;
                return 0;
            });
        this.position = position;
    }

    public static async minPosition(queue: Queue): Promise<number> {
        return Song.createQueryBuilder('song')
            .select('MIN(song.position)', 'min')
            .where({ queue: queue, active: true })
            .getRawOne()
            .then((p) => {
                if (p && p.min !== undefined && p.min !== null) return p.min;
                return 0;
            });
    }

    public static async minInactivePosition(queue: Queue): Promise<number> {
        return Song.createQueryBuilder('song')
            .select('MIN(song.position)', 'min')
            .where({ queue: queue, active: false })
            .getRawOne()
            .then((p) => {
                if (p && p.min !== undefined && p.min !== null) return p.min;
                return 0;
            });
    }

    public static async saveAll(
        songs: Song[],
        guildId: string,
        clientId: string,
    ): Promise<void> {
        const queue: Queue | undefined = await Queue.findOne({
            guildId: guildId,
            clientId: clientId,
        });
        if (!queue) return;
        const position: number = await Song.createQueryBuilder('song')
            .select('MAX(song.position)', 'max')
            .where({ queue: queue, active: true })
            .getRawOne()
            .then((r) => {
                if (r && r.max !== undefined && r.max !== null)
                    return r.max + 1;
                return 0;
            });
        await this.save(
            songs.map((s, idx) => {
                s.position = idx + position;
                s.queue = queue;
                return s;
            }),
        );
    }

    public static async removeInactive() {
        const currentDate: Date = new Date();
        this.createQueryBuilder('song')
            .delete()
            .where(
                `song.timestamp + interval '${this.persistSeconds} second' <= :currentDate AND song.active = FALSE`,
                { currentDate },
            )
            .execute();
    }
}
