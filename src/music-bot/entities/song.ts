import {
    BaseEntity,
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

    @Column('text', { nullable: true })
    public shortName: string | null;

    @Column({ nullable: false })
    public durationSeconds: number;

    @Column({ nullable: false, default: Math.floor(Math.random() * 16777215) })
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
        orphanedRowAction: 'nullify',
        onDelete: 'SET NULL',
        lazy: true,
        nullable: true,
    })
    public prev: Promise<Song | null>;

    public previous: Song | null;

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

    public static async maxPosition(queue: Queue): Promise<number> {
        return Song.createQueryBuilder('song')
            .select('MAX(song.position)', 'max')
            .where({ queue: queue, active: true })
            .getRawOne()
            .then((p) => {
                if (p && p.max !== undefined && p.max !== null) return p.max;
                return 0;
            });
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
        addFront?: boolean,
    ): Promise<void> {
        const queue: Queue | undefined = await Queue.findOne({
            guildId: guildId,
            clientId: clientId,
        });
        if (!queue) return;
        const s: string = addFront == true 
            ? 'MIN(song.position)'
            : 'MAX(song.position)';
        let position: number = await Song.createQueryBuilder('song')
            .select(s, 'm')
            .where({ queue: queue, active: true })
            .getRawOne()
            .then((r) => {
                if (r && r.m !== undefined && r.m !== null)
                    return r.m;
                return 0;
            });
        if (addFront) position -= songs.length + 1;

        for (let i = 1; i <= songs.length; i++) {
            songs[i - 1].position = position + i;
            songs[i - 1].queue = queue;
            if (queue.headSong && addFront)
                queue.headSong.position = songs[i - 1].position - 1;
        }
        if (queue.headSong && addFront) {
            queue.headSong.position -= songs.length + 1;
            await this.save(queue.headSong);
        }
        await this.save(songs);
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
