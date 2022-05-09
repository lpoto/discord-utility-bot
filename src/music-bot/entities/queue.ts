import {
    AfterLoad,
    BaseEntity,
    Column,
    Entity,
    Index,
    JoinTable,
    ManyToMany,
    Not,
    PrimaryColumn,
    SelectQueryBuilder,
} from 'typeorm';
import { QueueOption } from './queue-option';
import { Song } from './song';

@Entity('queue')
export class Queue extends BaseEntity {
    public static readonly songsPerPage: number = 10;

    @PrimaryColumn()
    public clientId: string;

    @PrimaryColumn()
    public guildId: string;

    @Index()
    @Column({ nullable: false })
    public messageId: string;

    @Index()
    @Column({ nullable: false })
    public threadId: string;

    @Column({ nullable: false })
    public channelId: string;

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
        if (this.headSong) this.headSong.previous = await this.headSong.prev;

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
        if (!this.headSong)
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

    public async getAllSongsWithoutHead(): Promise<Song[]> {
        if (this.headSong)
            return Song.find({
                queue: this,
                active: true,
                id: Not(this.headSong.id),
            });
        else return Song.find({ queue: this, active: true });
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

    public removeDropdownOptions(): Queue {
        this.options = this.options.filter(
            (o) =>
                ![
                    QueueOption.Options.REMOVE_SELECTED,
                    QueueOption.Options.TRANSLATE_SELECTED,
                    QueueOption.Options.FORWARD_SELECTED,
                ].includes(o.name),
        );
        return this;
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

    public async removeHeadSongs(n: number): Promise<Queue> {
        if (!this.headSong) return this;
        const song: Song = this.headSong;
        const pos: number | undefined = await Song.createQueryBuilder('song')
            .where({
                active: true,
            })
            .offset(n - 1)
            .orderBy({
                position: 'ASC',
            })
            .getOne()
            .then((s) => {
                if (!s) return undefined;
                return s.position;
            });
        const whereQuery: SelectQueryBuilder<Song> = Song.createQueryBuilder(
            'song',
        )
            .select('song.id')
            .where(
                'song.active = TRUE' +
                    (pos ? ` AND song.position <= ${pos}` : ''),
            )
            .limit(n);
        const where = `song.id IN (${whereQuery.getSql()})`;
        if (this.hasOption(QueueOption.Options.LOOP_QUEUE)) {
            const max: number = (await Song.maxPosition(this)) + 1;
            const min: number = await Song.minPosition(this);
            const query = Song.createQueryBuilder('song')
                .from(Song, 'song')
                .where(where)
                .update()
                .set({
                    position: () => `song.position + ${max} - ${min}`,
                    active: true,
                    timestamp: new Date(),
                });
            await query.execute();
        } else {
            const min: number = (await Song.minInactivePosition(this)) - 1;
            await Song.createQueryBuilder('song')
                .from(Song, 'song')
                .where(where)
                .update()
                .set({
                    active: false,
                    position: () => `${min} - song.position`,
                    timestamp: new Date(),
                })
                .execute();
        }

        await this.reload();
        if (this.headSong && this.headSong.id !== song.id) {
            this.headSong.prev = Promise.resolve(song);
            this.headSong = await this.headSong.save();
        }

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
    }
}
