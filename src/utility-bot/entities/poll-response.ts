import {
    BaseEntity,
    Column,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Poll } from './poll';

@Entity()
export class PollResponse extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
    public id: number;

    @Column({ nullable: false })
    public name: string;

    @Column('text', { array: true, default: [], nullable: false })
    public users: string[];

    @ManyToOne(() => Poll, (p) => p.responses, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        orphanedRowAction: 'delete',
        nullable: false,
    })
    public poll: Poll;
}
