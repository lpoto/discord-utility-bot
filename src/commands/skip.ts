import { AudioPlayerStatus } from '@discordjs/voice';
import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { CommandName } from '.';
import { MusicClient } from '../client';
import { Queue, Song } from '../entities';
import { AbstractCommand } from '../models';

export class Skip extends AbstractCommand {
    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'skip', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'skip', 'label']))
            .setDisabled(
                queue.songs.length === 0 ||
                    this.audioPlayer?.state.status ===
                        AudioPlayerStatus.Paused,
            )
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        try {
            if (
                !interaction ||
                !this.audioPlayer ||
                this.audioPlayer.state.status === AudioPlayerStatus.Paused
            )
                return;
            const queue: Queue | undefined = await this.getQueue();
            if (!queue) return;

            this.audioPlayer.stop();
            this.audioPlayer.removeAllListeners();
            this.client.setAudioPlayer(queue.guildId, null);
            if (!queue.options.includes('loop')) {
                const song: Song | undefined = queue.songs.shift();
                if (song) {
                    if (queue.options.includes('loopQueue')) {
                        song.position =
                            Math.max.apply(
                                null,
                                queue.songs.map((s) => s.position),
                            ) + 1;
                        await song.save();
                    } else {
                        await song.remove();
                    }
                    await queue.reload();
                }
            }

            if (queue.songs.length > 0) {
                this.client.musicActions.commands.execute(
                    CommandName.PLAY,
                    this.guildId,
                );
                if (
                    interaction &&
                    !interaction.deferred &&
                    !interaction.replied
                )
                    interaction
                        .deferUpdate()
                        .catch((e) => this.client.handleError(e, 'skip.ts'));
            } else if (
                interaction &&
                !interaction.deferred &&
                !interaction.replied
            ) {
                this.client.musicActions
                    .updateQueueMessageWithInteraction(
                        interaction,
                        queue,
                        false,
                        false,
                        true,
                    )
                    .catch((e) => this.client.handleError(e, 'skip.ts'));
            }
        } catch (e) {
            console.error('Error when skipping: ', e);
        }
    }
}
