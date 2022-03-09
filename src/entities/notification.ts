import moment from 'moment';
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
    readonly id: string;

    @Column('timestamp', { default: () => '((CURRENT_TIMESTAMP))' })
    readonly created: Date;

    @Column({ nullable: false })
    name: string;

    @Column({ nullable: false })
    clientId: string;

    @Column({ nullable: false })
    guildId: string;

    @Column({ nullable: true })
    expires: Date;

    @Column({ nullable: true })
    userId: string;

    @Column({ nullable: true })
    content: string;

    @BeforeInsert()
    purgeAfterTimeout(): void {
        if (this.expires === null || this.expires === undefined) return;
        let dif: number = moment(this.expires).diff(moment.now());
        if (dif < 0) dif = 0;
        const timeout: NodeJS.Timeout = setTimeout(() => {
            const currentDate: Date = new Date();
            Notification.createQueryBuilder('notification')
                .delete()
                .where('notification.expires <= :currentDate', { currentDate })
                .execute();
        }, dif);
        timeout.unref();
    }
}
