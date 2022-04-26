import {
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
    public readonly created: Date;

    @Column({ nullable: false })
    public color: number;

    @OneToMany(() => GuildRole, (r) => r.message, {
        cascade: true,
        eager: true,
    })
    public roles: GuildRole[];

    @BeforeInsert()
    public setColor(): void {
        this.color = Math.floor(Math.random() * 16777215);
    }
}
