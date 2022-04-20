import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractCommand } from '../utils';

export class JumpForward extends AbstractCommand {
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
            'jumpForward',
            'description',
        ]);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'jumpForward', 'label']),
            )
            .setDisabled(queue.size === 0 || this.audioPlayer?.paused)
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

        // emit jumpForward debug message to audioPlayer
        // (jumpForward event handled in play command)
        if (this.audioPlayer) {
            this.audioPlayer.trigger('jumpForward', interaction);
            setTimeout(() => {
                this.updateQueue({ queue: queue, interaction: interaction });
            }, 200);
        }
    }
}
