import { ButtonInteraction, GuildMember, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractCommand } from '../utils';

export class Replay extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get interactionTimeout(): number {
        return 500;
    }

    public get description(): string {
        return this.translate(['music', 'commands', 'replay', 'description']);
    }

    public get checkRolesFor(): string {
        return this.translate([
            'music',
            'commands',
            'replay',
            'rolesConfigName',
        ]);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'replay', 'label']))
            .setDisabled(queue.size === 0)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !(interaction.member instanceof GuildMember))
            return;
        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;

        // emit replay debug message to audioPlayer
        // (replay event handled in play command)
        if (this.audioPlayer) this.audioPlayer.trigger('replay', interaction);
        else
            this.client.emitEvent('executeCommand', {
                name: 'Play',
                interaction: interaction,
                member: interaction.member,
            });
    }
}
