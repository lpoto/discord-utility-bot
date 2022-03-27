import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue, QueueOption } from '../entities';
import { AbstractCommand } from '../utils';

export class Skip extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get interactionTimeout(): number {
        return 600;
    }

    public get description(): string {
        return this.translate(['music', 'commands', 'skip', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'skip', 'label']))
            .setDisabled(
                queue.size === 0 ||
                    this.audioPlayer?.paused ||
                    (!queue.headSong?.previous && !queue.previousSong) ||
                    queue.hasOption(QueueOption.Options.LOOP),
            )
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            !interaction.guildId ||
            (this.audioPlayer && this.audioPlayer.paused)
        )
            return;
        const queue: Queue | undefined = await this.getQueue();
        if (!queue || !queue.headSong) return;

        // emit skip debug message to audioPlayer
        // (skip event handled in play command)
        if (this.audioPlayer) this.audioPlayer.trigger('skip', interaction);
        else
            this.client.emitEvent('executeCommand', {
                name: 'Play',
                guildId: queue.guildId,
                interaction: interaction,
            });
    }
}
