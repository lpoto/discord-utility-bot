import { ButtonInteraction, GuildMember } from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractMusicEvent } from '../utils/abstract-music-event';

export class OnButtonClick extends AbstractMusicEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(interaction: ButtonInteraction): Promise<void> {
        if (
            this.client.ready &&
            interaction.component !== undefined &&
            interaction.component.label !== null &&
            interaction.component.label !== undefined
        ) {
            this.eventQueue.addToQueue(interaction.message.id, () =>
                this.execute(interaction),
            );
        }
    }

    private async execute(interaction: ButtonInteraction): Promise<void> {
        if (!interaction.guildId || !this.client.user) return;
        await Queue.findOne({
            guildId: interaction.guildId,
            clientId: this.client.user.id,
        }).then((queue) => {
            if (
                !queue ||
                !interaction.member ||
                !interaction.component.label ||
                !(interaction.member instanceof GuildMember)
            )
                return;
            this.client.logger.debug(
                `Button '${interaction.component.label}'`,
                'on queue message in guild',
                `'${interaction.guildId}'`,
            );
            this.client.emitEvent('executeCommand', {
                member: interaction.member,
                interaction: interaction,
            });
        });
    }
}

export namespace OnButtonClick {
    export type Type = [
        'buttonClick',
        ...Parameters<OnButtonClick['callback']>,
    ];
}
