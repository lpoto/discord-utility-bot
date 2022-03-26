import {
    AfterLoad,
    BaseEntity,
    Column,
    Entity,
    JoinTable,
    ManyToMany,
    Not,
    PrimaryColumn,
} from 'typeorm';
import { Languages } from '../translation';
import { QueueOption } from './queue-option';
import { Song } from './song';

@Entity('queue')
export class Queue extends BaseEntity {
    public static readonly songsPerPage: number = 10;

    @PrimaryColumn()
    public clientId: string;

    @PrimaryColumn()
    public guildId: string;

    @Column({ nullable: false })
    public channelId: string;

    @Column({ nullable: false })
    public messageId: string;

    @Column({ nullable: false })
    public threadId: string;

    @Column({ nullable: false })
    public offset: number;

    @ManyToMany(() => QueueOption, (queueOption) => queueOption.queue, {
        eager: true,
    })
    @JoinTable()
    public options: QueueOption[];

    public headSong: Song | undefined;
    public previousSong: Song | undefined;
    public curPageSongs: Song[] = [];
    public size = 0;

    @AfterLoad()
    public async afterQueueLoad(): Promise<void> {
        // count all songs referencing this queue
        this.size = await Song.count({ where: { queue: this, active: true } });

        this.checkOffset();
        this.checkOptions();

        // Set a headSong (song with smallest position)
        await this.reloadHeadSong();
        if (this.headSong)
            this.headSong.previous = await this.headSong.getPrevious;

        // Load only as many songs that fit a single embed page (based on offset)
        this.curPageSongs = await Song.createQueryBuilder('song')
            .where({ queue: this, id: Not(this.headSong?.id), active: true })
            .orderBy({ position: 'ASC' })
            .limit(Queue.songsPerPage)
            .offset(this.offset)
            .getMany();

        if (
            !Song.lastClearedInactive ||
            new Date().valueOf() - Song.lastClearedInactive.valueOf() >=
                Song.persistSeconds * 1000
        ) {
            await Song.removeInactive();
            Song.lastClearedInactive = new Date();
        }

        const minInactivePosition: number = await Song.minInactivePosition(
            this,
        );
        this.previousSong = await Song.findOne({
            where: {
                queue: this,
                position: minInactivePosition,
                active: false,
            },
        });
    }

    public async getAllSongs(): Promise<Song[]> {
        return Song.find({ queue: this, active: true });
    }

    public hasOption(o: QueueOption.Options): boolean {
        if (!this.options) return false;
        return this.options.find((o2) => o2.name === o) !== undefined;
    }

    public hasDropdownOption(): boolean {
        return (
            this.options.find((o) =>
                [
                    QueueOption.Options.REMOVE_SELECTED,
                    QueueOption.Options.TRANSLATE_SELECTED,
                    QueueOption.Options.FORWARD_SELECTED,
                ].includes(o.name),
            ) !== undefined
        );
    }

    public removeDropdownOptions(): void {
        this.options = this.options.filter(
            (o) =>
                ![
                    QueueOption.Options.REMOVE_SELECTED,
                    QueueOption.Options.TRANSLATE_SELECTED,
                    QueueOption.Options.FORWARD_SELECTED,
                ].includes(o.name),
        );
    }

    public async addOption(o: QueueOption.Options): Promise<Queue> {
        return QueueOption.findOne(o).then((opt) => {
            if (!opt) return this;
            if (
                this.options.find((opt2) => opt2.name === opt.name) !==
                undefined
            )
                return this;
            this.options.push(opt);
            return this;
        });
    }

    public removeOptions(options: QueueOption.Options[]): Queue {
        if (this.options)
            this.options = this.options.filter(
                (o) => !options.includes(o.name),
            );
        return this;
    }

    public async removeHeadSong(reload?: boolean): Promise<Queue> {
        if (!this.headSong) return this;
        if (this.hasOption(QueueOption.Options.LOOP)) return this;
        const active: boolean = this.hasOption(QueueOption.Options.LOOP_QUEUE);
        if (active) {
            this.headSong.queue = this;
            this.headSong.active = true;
            await this.headSong.generatePosition();
        } else {
            this.headSong.position =
                (await Song.minInactivePosition(this)) - 1;
            this.headSong.active = false;
        }
        this.headSong.timestamp = new Date();
        const song: Song = await this.headSong?.save();
        await this.reloadHeadSong();
        if (this.headSong && this.headSong.id !== song.id) {
            this.headSong.getPrevious = Promise.resolve(song);
            await this.headSong.save();
        }
        if (reload) await this.reload();
        return this;
    }

    private async reloadHeadSong(): Promise<void> {
        const minPosition: number = await Song.minPosition(this);
        this.headSong = await Song.findOne({
            where: {
                queue: this,
                position: minPosition,
                active: true,
            },
        });
    }

    private checkOffset(): void {
        if (this.offset === 0) return;
        while (this.offset + 1 >= this.size) this.offset -= Queue.songsPerPage;
        if (this.offset < 0) this.offset = 0;
    }

    private async checkOptions(): Promise<void> {
        if (this.size < 2) {
            this.removeOptions([
                QueueOption.Options.FORWARD_SELECTED,
                QueueOption.Options.REMOVE_SELECTED,
            ]);
        } else if (this.size < 3) {
            this.removeOptions([QueueOption.Options.REMOVE_SELECTED]);
        }
        if (Object.keys(Languages).length < 2) {
            this.removeOptions([QueueOption.Options.TRANSLATE_SELECTED]);
        }
    }
}
