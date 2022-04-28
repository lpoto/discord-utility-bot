import {
    AfterInsert,
    BaseEntity,
    Column,
    Entity,
    OneToMany,
    PrimaryColumn,
} from 'typeorm';
import { PollResponse } from './poll-response';

@Entity()
export class Poll extends BaseEntity {
    @PrimaryColumn()
    public messageId: string;

    @Column()
    public guildId: string;

    @Column()
    public channelId: string;

    @Column()
    public question: string;

    @Column({ default: false })
    public commited: boolean;

    @Column('timestamp', { default: () => '((CURRENT_TIMESTAMP))' })
    public created: Date;

    @OneToMany(() => PollResponse, (pr) => pr.poll, {
        cascade: true,
        eager: true,
    })
    public responses: PollResponse[];

    @AfterInsert()
    public async removeOldMessages(): Promise<void> {
        return await Poll.removeOldMessages();
    }

    public static async removeOldMessages(): Promise<void> {
        const currentDate: Date = new Date();
        await Poll.createQueryBuilder('poll')
            .delete()
            .where(
                `poll.created + interval '${24} hour' ` +
                    '< :currentDate AND poll.commited = FALSE',
                { currentDate },
            )
            .execute();
    }
}
