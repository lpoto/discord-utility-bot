import { BaseEntity, Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
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

    @Column('text', { array: true })
    options: string[];

    @OneToMany(() => Song, (song) => song.queue, {
        cascade: true,
        eager: true,
    })
    songs: Song[];

    public forward(idx: number): void {
        if (idx < 2 || this.songs.length < 3 || idx >= this.songs.length)
            return;
        const song: Song = this.songs[1];
        this.songs[1] = this.songs[idx];
        this.songs[idx] = song;
    }

    public async clear(): Promise<void> {
        if (this.songs.length < 2) return;
        this.songs.splice(1, this.songs.length - 1);
    }

    public forwardByIndex(index: number): void {
        if (this.songs.length < 3 || index >= this.songs.length) return;
        const toReplace: Song = this.songs[1];
        this.songs[1] = this.songs[index];
        this.songs[index] = toReplace;
    }
}
