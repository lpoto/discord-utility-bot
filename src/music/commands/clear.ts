import {
    ButtonInteraction,
    InteractionWebhook,
    MessageButton,
} from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicCommandOptions } from '.';
import { Command } from '../models';

export class Clear extends Command {
    constructor(options: MusicCommandOptions) {
        super(options);
    }

    get description(): string {
        return this.translate(['music', 'commands', 'clear', 'description']);
    }

    get button(): MessageButton | null {
        if (!this.music.editing) return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'clear', 'label']))
            .setDisabled(this.music.queue.size < 2)
            .setStyle(
                this.music.clearRequest
                    ? MessageButtonStyles.PRIMARY
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            interaction.deferred ||
            interaction.replied ||
            !interaction.component ||
            !interaction.user ||
            !this.music.thread
        )
            return;
        if (interaction.component.style === 'PRIMARY') {
            const songs: string =
                '`' +
                this.music.queue.allSongs
                    .slice(1)
                    .map((s) => s.name)
                    .join('\n') +
                '`';
            this.music.clearRequest = false;
            this.music.queue.clear().then(() => {
                this.music.actions
                    .updateQueueMessageWithInteraction(interaction)
                    .then(() => {
                        interaction.user.send({
                            content:
                                this.translate([
                                    'music',
                                    'commands',
                                    'clear',
                                    'clearedSongs',
                                ]) + songs,
                        });
                    });
            });
        } else {
            this.music.clearRequest = true;
            const webhook: InteractionWebhook = interaction.webhook;
            this.music.actions
                .updateQueueMessageWithInteraction(interaction)
                .then((result) => {
                    if (!result) return;
                    webhook.send({
                        content: this.translate([
                            'music',
                            'commands',
                            'clear',
                            'confirm',
                        ]),
                        ephemeral: true,
                    });
                    const x: NodeJS.Timeout = setTimeout(() => {
                        this.music.clearRequest = false;
                        this.music.actions.updateQueueMessage();
                    }, 5000);
                    x.unref();
                });
        }
    }
}
