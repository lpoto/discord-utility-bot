import { AudioPlayerStatus } from '@discordjs/voice';
import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractCommand } from '../utils';

export class Skip extends AbstractCommand {
    private toDefer: { [guildId: string]: ButtonInteraction[] };

    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
        this.toDefer = {};
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
            !this.audioPlayer ||
            this.audioPlayer.state.status === AudioPlayerStatus.Paused
        )
            return;
        const guildId: string = interaction.guildId;
        if (guildId in this.toDefer) {
            this.toDefer[guildId].push(interaction);
            return;
        } else {
            this.toDefer[guildId] = [];
        }
        const queue: Queue | undefined = await this.getQueue();
        if (!queue || !queue.headSong) return;

        // emit skip debug message to audioPlayer
        // (skip event handled in play command)
        this.client.emitEvent('queueMessageUpdate', {
            queue: queue,
            interaction: interaction,
            timeout: 750,
            onUpdate: () => this.deferInteractions(queue.guildId),
            onError: () => this.deferInteractions(queue.guildId, true),
        });
        this.audioPlayer.emit('debug', 'skip');
    }

    private async deferInteractions(
        guildId: string,
        doNotDefer?: boolean,
    ): Promise<void> {
        if (!(guildId in this.toDefer)) return;
        if (!doNotDefer)
            for (const i of this.toDefer[guildId])
                i.deferUpdate().catch((e) => {
                    this.client.emit('error', e);
                });
        delete this.toDefer[guildId];
    }
}
