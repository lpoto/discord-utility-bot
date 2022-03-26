import { AudioPlayerStatus } from '@discordjs/voice';
import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
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
                    this.audioPlayer?.state.status ===
                        AudioPlayerStatus.Paused,
            )
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            !interaction.guildId ||
            (this.audioPlayer &&
                this.audioPlayer.state.status === AudioPlayerStatus.Paused)
        )
            return;
        const queue: Queue | undefined = await this.getQueue();
        if (!queue || !queue.headSong) return;

        // emit skip debug message to audioPlayer
        // (skip event handled in play command)
        this.updateQueue({
            queue: queue,
            interaction: interaction,
            timeout: 200,
        });
        if (this.audioPlayer) this.audioPlayer.emit('debug', 'skip');
        else
            this.client.emitEvent('executeCommand', {
                name: 'Play',
                guildId: queue.guildId,
            });
    }
}
