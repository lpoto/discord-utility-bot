import {
    BaseEntity,
    Entity,
    JoinTable,
    ManyToMany,
    PrimaryColumn,
} from 'typeorm';
import { Queue } from '.';

@Entity('queue_option')
export class QueueOption extends BaseEntity {
    @PrimaryColumn()
    public name: QueueOption.Options;

    @ManyToMany(() => Queue, (queue) => queue.options, {
        lazy: true,
    })
    @JoinTable()
    public queue: Promise<Queue>;

    public static async seed(): Promise<void> {
        for await (const o of Object.values(QueueOption.Options)) {
            const option: QueueOption | undefined = await QueueOption.findOne(
                o,
            );
            if (option) return;
            await QueueOption.create({
                name: o,
            }).save();
        }
    }
}

export namespace QueueOption {
    export enum Options {
        EDITING = 'editing',
        FORWARD_SELECTED = 'forwardSelected',
        REMOVE_SELECTED = 'removeSelected',
        TRANSLATE_SELECTED = 'translateSelected',
        STOP_SELECTED = 'stopSelected',
        CLEAR_SELECTED = 'clearSelected',
        LOOP_QUEUE = 'loopQueue',
        EXPANDED = 'expanded',
    }
}
