import {
    AfterInsert,
    BaseEntity,
    BeforeInsert,
    Column,
    Entity,
    OneToMany,
    PrimaryColumn,
} from 'typeorm';
import { GuildRole } from './role';

@Entity({ name: 'roles_message' })
export class RolesMessage extends BaseEntity {
    public static rolesPerPage = 20;

    @PrimaryColumn()
    public messageId: string;

    @Column()
    public guildId: string;

    @Column()
    public channelId: string;

    @Column('text', { nullable: true, default: null })
    public name: string | null;

    @Column({ default: false })
    public commited: boolean;

    @Column({ default: 0 })
    public offset: number;

    @Column('timestamp', { default: () => '((CURRENT_TIMESTAMP))' })
    public created: Date;

    @Column({ nullable: false })
    public color: number;

    @OneToMany(() => GuildRole, (r) => r.message, {
        cascade: true,
        eager: true,
    })
    public roles: GuildRole[];

    @BeforeInsert()
    public setColor(): void {
        if (!this.color) this.color = Math.floor(Math.random() * 16777215);
    }

    @AfterInsert()
    public async removeOldMessages(): Promise<void> {
        await RolesMessage.removeOldMessages();
    }

    public static async removeOldMessages(): Promise<void> {
        const currentDate: Date = new Date();
        await RolesMessage.createQueryBuilder('roles_message')
            .delete()
            .where(
                `roles_message.created + interval '${24} hour' ` +
                    '< :currentDate AND roles_message.commited = FALSE',
                { currentDate },
            )
            .execute();
    }
}
