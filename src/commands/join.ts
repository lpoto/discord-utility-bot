import { ButtonInteraction, MessageButton } from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractCommand, CustomAudioPlayer } from '../utils';

export class Join extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string {
        return this.translate(['music', 'commands', 'join', 'description']);
    }

    public get interactionTimeout(): number {
        return 300;
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
        const audioPlayer: CustomAudioPlayer | null = this.audioPlayer;
        if (audioPlayer && audioPlayer.playing) return;
        audioPlayer?.kill();
        this.client.setAudioPlayer(queue.guildId, null);
        this.updateQueue({
            interaction: interaction,
            queue: queue,
            timeout: 300,
            doNotSetUpdated: true,
        });
        if (queue.size > 0)
            this.client.emitEvent('executeCommand', {
                name: 'Play',
                guildId: this.guildId,
                interaction: interaction,
            });
    }
}
