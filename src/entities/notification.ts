import {
    BaseEntity,
    Column,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('notification')
@Index(['name', 'clientId', 'guildId', 'userId'], { unique: true })
export class Notification extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
    readonly id: number;

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

    @Column({ nullable: false })
    content: string;

    static async purgeOldNotifications(): Promise<void> {
        const interval: NodeJS.Timer = setInterval(() => {
            const currentDate: Date = new Date();
            Notification.createQueryBuilder('notification')
                .delete()
                .where('notification.expires <= :currentDate', { currentDate })
                .execute();
        }, 3600000);
        interval.unref();
    }
}
