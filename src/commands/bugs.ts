import { AudioPlayerStatus } from '@discordjs/voice';
import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue, QueueOption } from '../entities';
import { AbstractCommand } from '../utils';

export class Bugs extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string {
        return this.translate(['music', 'commands', 'bugs', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection || !queue.hasOption(QueueOption.Options.EDITING))
            return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'bugs', 'label']))
            .setDisabled(true)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            !this.audioPlayer ||
            this.audioPlayer.state.status === AudioPlayerStatus.Paused
        )
            return;
    }
}
