import { BaseEntity, Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { RolesMessage } from './roles-message';

@Entity({ name: 'role' })
export class GuildRole extends BaseEntity {
    @PrimaryColumn()
    public id: string;

    @Column({ nullable: false })
    public name: string;

    @ManyToOne(() => RolesMessage, (rm) => rm.roles, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        orphanedRowAction: 'delete',
        nullable: false,
    })
    public message: RolesMessage;
}
