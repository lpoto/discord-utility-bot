import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue, QueueOption, Song } from '../entities';
import { AbstractCommand } from '../utils';

export class previousSong extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get interactionTimeout(): number {
        return 600;
    }

    public get description(): string {
        return this.translate([
            'music',
            'commands',
            'previousSong',
            'description',
        ]);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'previousSong', 'label']),
            )
            .setDisabled(
                (!queue.headSong?.previous && !queue.previousSong) ||
                    queue.hasOption(QueueOption.Options.LOOP),
            )
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction) return;
        const queue: Queue | undefined = await this.getQueue();
        if (
            !queue ||
            ((!queue.headSong || !queue.headSong.previous) &&
                !queue.previousSong)
        )
            return;
        const song: Song | undefined =
            queue.headSong && queue.headSong.previous
                ? queue.headSong.previous
                : queue.previousSong;
        if (!song) return;
        song.position =
            queue.headSong && queue.headSong.previous
                ? queue.headSong.position - 1
                : 0;
        song.active = true;
        song.queue = queue;
        await song.save();

        this.updateQueue({
            queue: queue,
            interaction: interaction,
            timeout: 300,
        });

        if (!this.audioPlayer) {
            if (!interaction.guildId) return;
            this.client.emitEvent('executeCommand', {
                name: 'Play',
                guildId: interaction.guildId,
            });
        } else {
            this.audioPlayer.emit('debug', 'previous');
        }
    }
}
