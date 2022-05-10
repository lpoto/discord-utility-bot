import { ButtonInteraction, Message, MessageButton } from 'discord.js';
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

    public get checkRolesFor(): string {
        return this.translate([
            'music',
            'commands',
            'jumpForward',
            'rolesConfigName',
        ]);
    }

    public get reggex(): RegExp {
        return /^!((\+(\+)?)|(forward)|(j((um)?p)?)((\s+)-?\d+)?)$/i;
    }

    public get additionalHelp(): string {
        return this.translate([
            'music',
            'commands',
            'jumpForward',
            'additionalHelp',
        ]);
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
            .setDisabled(
                queue.size === 0 ||
                    (this.audioPlayer !== null && !this.audioPlayer.paused),
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

        // emit jumpForward debug message to audioPlayer
        // (jumpForward event handled in play command)
        if (this.audioPlayer) {
            this.audioPlayer.trigger('jumpForward', interaction);
            setTimeout(() => {
                this.updateQueue({ queue: queue, interaction: interaction });
            }, 200);
        }
    }

    public async executeFromReggex(message: Message): Promise<void> {
        const queue: Queue | undefined = await this.getQueue();
        if (!queue || !this.audioPlayer) return;

        const l: string[] = message.content.split(/\s+/);
        let t: number | undefined = undefined;
        if (l.length > 1 && l[1].length > 0) {
            try {
                t = Number(l[1].trim());
            } catch (e) {
                if (e instanceof Error) this.client.emitEvent('error', e);
            }
        }
        this.audioPlayer.trigger('jumpForward', undefined, t);
        setTimeout(() => {
            this.updateQueue({ queue: queue });
        }, 200);
    }
}
