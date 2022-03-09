import { AudioPlayer, AudioPlayerStatus } from '@discordjs/voice';
import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractCommand } from '../models';

export class Join extends AbstractCommand {
    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'join', 'description']);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public button(queue: Queue): MessageButton | null {
        if (this.connection) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'join', 'label']))
            .setDisabled(false)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public button2(queue: Queue): MessageButton | null {
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'join', 'label']))
            .setDisabled(false)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        const audioPlayer: AudioPlayer | null = this.audioPlayer;
        if (
            audioPlayer &&
            audioPlayer.state.status === AudioPlayerStatus.Playing
        )
            return;
        try {
            audioPlayer?.stop();
        } catch (e) {}
        this.client.setAudioPlayer(queue.guildId, null);
        if (queue.songs.length > 0) {
            if (interaction && !interaction.deferred && !interaction.replied)
                interaction
                    .deferUpdate()
                    .catch((e) =>
                        this.client.handleError(e, 'join.ts -> execute'),
                    );

            this.client.musicActions.commands.execute('Play', this.guildId);
        } else if (
            interaction &&
            !interaction.deferred &&
            !interaction.replied
        ) {
            this.client.musicActions.updateQueueMessage({
                interaction: interaction,
                queue: queue,
                componentsOnly: true,
            });
        }
    }
}
