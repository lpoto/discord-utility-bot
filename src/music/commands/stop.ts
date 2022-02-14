import {
    ButtonInteraction,
    InteractionWebhook,
    MessageButton,
} from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from '../models';

export class Stop extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'stop', 'description']);
    }

    get button(): MessageButton {
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'stop', 'label']))
            .setStyle(
                this.music.stopRequest
                    ? MessageButtonStyles.PRIMARY
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            !interaction.component ||
            !interaction.user ||
            interaction.deferred ||
            interaction.replied
        )
            return;
        if (interaction.component.style === 'PRIMARY') {
            this.music.client.destroyMusic(this.music.guildId);
            if (this.music.queue && this.music.queue.size > 0)
                interaction.user.send({
                    content:
                        this.translate([
                            'music',
                            'commands',
                            'stop',
                            'reply',
                        ]) +
                        '`' +
                        this.music.queue.allSongs
                            .map((s) => s.name)
                            .join('\n') +
                        '`',
                });
        } else {
            this.music.stopRequest = true;
            const webhook: InteractionWebhook = interaction.webhook;
            this.music.actions
                .updateQueueMessageWithInteraction(interaction)
                .then((result) => {
                    if (!result) return;
                    webhook.send({
                        content: this.translate([
                            'music',
                            'commands',
                            'stop',
                            'confirm',
                        ]),
                        ephemeral: true,
                    });
                    setTimeout(() => {
                        this.music.stopRequest = false;
                        this.music.needsUpdate = true;
                    }, 5000);
                });
        }
    }
}
