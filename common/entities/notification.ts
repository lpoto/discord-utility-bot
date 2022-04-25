import {
    BaseEntity,
    BeforeInsert,
    Column,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('notification')
@Index(['name', 'clientId', 'guildId', 'userId'], { unique: true })
export class Notification extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public readonly id: string;

    @Column('timestamp', { default: () => '((CURRENT_TIMESTAMP))' })
    public readonly created: Date;

    @Column({ nullable: false })
    public name: string;

    @Column({ nullable: false })
    public clientId: string;

    @Column({ nullable: false })
    public guildId: string;

    @Column('decimal', { nullable: true })
    public minutesToPersist: number;

    @Column({ nullable: true })
    public userId: string;

    @Column({ nullable: true })
    public content: string;

    @BeforeInsert()
    public purgeAfterTimeout(): void {
        if (!this.minutesToPersist) return;
        const t: number = this.minutesToPersist * 60 * 1000;
        const timeout: NodeJS.Timeout = setTimeout(() => {
            const currentDate: Date = new Date();
            Notification.createQueryBuilder('notification')
                .delete()
                .where(
                    `notification.created + interval '${this.minutesToPersist} minute' <= :currentDate`,
                    { currentDate },
                )
                .execute();
        }, t);
        timeout.unref();
    }
}
