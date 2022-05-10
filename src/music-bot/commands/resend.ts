import { ButtonInteraction, Message, MessageButton } from 'discord.js';
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

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !this.client.user ||
            interaction === undefined ||
            !(interaction.message instanceof Message) ||
            interaction.message.author.id !== this.client.user.id
        )
            return;
        const msg: Message = interaction.message;
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
            interaction: interaction,
            queue: queue,
            resend: true,
        });
        const timeout: NodeJS.Timeout = setTimeout(() => {
            msg.delete().catch((e) => {
                this.client.emitEvent('error', e);
            });
        }, 300);
        timeout.unref();
    }
}
