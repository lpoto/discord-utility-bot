import { Message } from 'discord.js';
import { MusicClient } from '../client';
import { Queue, QueueOption } from '../entities';
import { AbstractMusicEvent } from '../utils/abstract-music-event';

export class OnReady extends AbstractMusicEvent {
    public constructor(client: MusicClient) {
        super(client);
        this.once = true;
    }

    public async callback(): Promise<void> {
        const queues: Queue[] = await Queue.find();
        for (let queue of queues) {
            const message: Message | null = await this.client
                .checkThreadAndMessage(queue, true)
                .catch(async (e) => {
                    this.client.emitEvent('error', e);
                    return null;
                });
            if (message == null) {
                await queue.remove().catch((e) => {
                    this.client.emitEvent('error', e);
                });
                continue;
            }
            queue.removeOptions([
                QueueOption.Options.STOP_SELECTED,
                QueueOption.Options.CLEAR_SELECTED,
            ]);
            queue = await queue.save();
        }
        await this.setup();
    }

    private async setup(): Promise<void> {
        if (!this.client.user) return;

        this.client.logger.info(
            `Music Client Logged in as user ${this.client.user.tag}`,
        );

        await QueueOption.seed();
        await this.client.registerSlashCommands(
            this.client.translator.getFullLanguage().music.slashCommands,
        );
        this.client.user.setActivity(
            '/' + this.client.translate(['music', 'slashCommands', 'name']),
            {
                type: 'LISTENING',
            },
        );
        this.client.ready = true;
        this.client.logger.info('Music Client ready!');
    }
}

export namespace OnReady {
    export type Type = ['ready', ...Parameters<OnReady['callback']>];
}
