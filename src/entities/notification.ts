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
    public readonly id: string;

    @Column('timestamp', { default: () => '((CURRENT_TIMESTAMP))' })
    public readonly created: Date;

    @Column({ nullable: false })
    public name: string;

    @Column({ nullable: false })
    public clientId: string;

    @Column({ nullable: false })
    public guildId: string;

    @Column({ nullable: true })
    public expires: Date;

    @Column({ nullable: true })
    public userId: string;

    @Column({ nullable: true })
    public content: string;

    @BeforeInsert()
    public purgeAfterTimeout(): void {
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
