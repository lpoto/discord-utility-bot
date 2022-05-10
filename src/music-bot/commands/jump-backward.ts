import { ButtonInteraction, GuildMember, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractCommand } from '../utils';

export class JumpBackward extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get interactionTimeout(): number {
        return 400;
    }

    public get checkRolesFor(): string {
        return this.translate([
            'music',
            'commands',
            'jumpBackward',
            'rolesConfigName',
        ]);
    }

    public get description(): string {
        return this.translate([
            'music',
            'commands',
            'jumpBackward',
            'description',
        ]);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'jumpBackward', 'label']),
            )
            .setDisabled(queue.size === 0)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            !interaction.guildId ||
            !(interaction.member instanceof GuildMember)
        )
            return;
        const queue: Queue | undefined = await this.getQueue();
        if (!queue || !queue.headSong) return;

        // emit jumpBackward debug message to audioPlayer
        // (jumpBackward event handled in play command)
        if (this.audioPlayer) {
            this.audioPlayer.trigger('jumpBackward', interaction);
            setTimeout(() => {
                this.updateQueue({ queue: queue, interaction: interaction });
            }, 200);
        } else {
            this.client.emitEvent('executeCommand', {
                name: 'Play',
                interaction: interaction,
                member: interaction.member,
            });
        }
    }
}
