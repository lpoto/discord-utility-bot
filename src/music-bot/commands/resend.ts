import {
    ButtonInteraction,
    Message,
    MessageButton,
    PartialMessage,
} from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue, QueueOption } from '../entities';
import { AbstractCommand } from '../utils';

export class Resend extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get alwaysExecute(): boolean {
        return true;
    }

    public get description(): string {
        return this.translate(['music', 'commands', 'resend', 'description']);
    }

    public get checkRolesFor(): string {
        return this.translate([
            'music',
            'commands',
            'resend',
            'rolesConfigName',
        ]);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection || !queue.hasOption(QueueOption.Options.EDITING))
            return null;
        return new MessageButton()
            .setLabel(
                this.client.translate([
                    'music',
                    'commands',
                    'resend',
                    'label',
                ]),
            )
            .setDisabled(false)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(
        interaction?: ButtonInteraction | Message | PartialMessage,
    ): Promise<void> {
        let message: Message | PartialMessage | undefined = undefined;
        let i: ButtonInteraction | undefined = undefined;
        if (
            interaction instanceof ButtonInteraction &&
            interaction.message instanceof Message
        ) {
            i = interaction;
            message = interaction.message;
        } else if (interaction instanceof Message) message = interaction;
        if (
            !message ||
            !this.client.user ||
            message.author.id !== this.client.user.id
        )
            return;
        let queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        this.client.logger.debug(
            `Resending queue message: '${queue.messageId}'`,
        );
        queue.messageId = '0'.repeat(18);
        queue.threadId = '0'.repeat(18);
        queue.channelId = '0'.repeat(18);
        queue = await queue.save();
        this.updateQueue({
            interaction: i,
            queue: queue,
            resend: true,
            message: message,
        });
        const timeout: NodeJS.Timeout = setTimeout(() => {
            if (message)
                message.delete().catch((e) => {
                    this.client.emitEvent('error', e);
                });
        }, 300);
        timeout.unref();
    }
}
