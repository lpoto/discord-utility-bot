import { AudioPlayer, AudioPlayerStatus } from '@discordjs/voice';
import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { CommandName } from '.';
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

    public button(queue: Queue): MessageButton | null {
        if (this.connection || queue.songs.length < 1) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'join', 'label']))
            .setDisabled(false)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public button2(queue: Queue): MessageButton | null {
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'join', 'label']))
            .setDisabled(false)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (interaction && !interaction.deferred && !interaction.replied)
            interaction.deferUpdate();

        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        const audioPlayer: AudioPlayer | null = this.audioPlayer;
        if (
            audioPlayer &&
            (audioPlayer.state.status === AudioPlayerStatus.Paused ||
                audioPlayer.state.status === AudioPlayerStatus.Playing)
        )
            return;
        if (queue.songs.length > 0)
            this.client.musicActions.commands.execute(
                CommandName.PLAY,
                this.guildId,
            );
    }
}
