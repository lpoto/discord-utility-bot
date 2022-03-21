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
            this.toDefer[guildId] = [interaction];
        }
        const timeout: NodeJS.Timeout = setTimeout(async () => {
            this.executeWithTimeout(interaction)
                .then(() => {
                    if (!(guildId in this.toDefer)) return;
                    for (const i of this.toDefer[guildId])
                        i.deferUpdate().catch((e) => {
                            this.client.emit('error', e);
                        });
                    delete this.toDefer[guildId];
                })
                .catch((e) => {
                    this.client.emit('error', e);
                    if (!(guildId in this.toDefer)) return;
                    delete this.toDefer[guildId];
                });
        }, 500);
        timeout.unref();
    }

    public async executeWithTimeout(
        interaction: ButtonInteraction,
    ): Promise<void> {
        let queue: Queue | undefined = await this.getQueue();
        if (!queue || !queue.headSong) return;
        const id: string = queue.headSong.id;

        queue = await this.getQueue();
        if (
            !queue ||
            !queue.headSong ||
            queue.headSong.id !== id ||
            !interaction ||
            !this.audioPlayer ||
            this.audioPlayer.state.status === AudioPlayerStatus.Paused
        )
            return;

        // emit skip debug message to audioPlayer
        // (skip event handled in play command)
        this.client.emitEvent('queueMessageUpdate', {
            queue: queue,
            interaction: interaction,
            timeout: 250,
        });
        this.audioPlayer.emit('debug', 'skip');
    }
}
