import {
    ButtonInteraction,
    GuildMember,
    Message,
    MessageButton,
} from 'discord.js';
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

    public get reggex(): RegExp {
        return /^!(s(kip)?(\s+\d+)?)$/i;
    }

    public get checkRolesFor(): string {
        return this.translate([
            'music',
            'commands',
            'skip',
            'rolesConfigName',
        ]);
    }

    public get additionalHelp(): string {
        return this.translate(['music', 'commands', 'skip', 'additionalHelp']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'skip', 'label']))
            .setDisabled(queue.size === 0)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            !interaction.guildId ||
            !(interaction.member instanceof GuildMember) ||
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
                member: interaction.member,
                interaction: interaction,
            });
    }

    public async executeFromReggex(message: Message): Promise<void> {
        if (!(message.member instanceof GuildMember)) return;
        const queue: Queue | undefined = await this.getQueue();
        if (!queue || !this.audioPlayer || queue.size === 0) return;

        if (!this.audioPlayer)
            return this.client.emitEvent('executeCommand', {
                name: 'Play',
                member: message.member,
            });

        const l: string[] = message.content.split(/\s+/);
        let t: number | undefined = undefined;
        if (l.length > 1 && l[1].length > 0) {
            try {
                t = Number(l[1].trim());
            } catch (e) {
                if (e instanceof Error) this.client.emitEvent('error', e);
            }
        }
        if (t && t > queue.size) t = queue.size;
        if (t && t < 0) t = undefined;
        this.audioPlayer.trigger('skip', undefined, t);
    }
}
