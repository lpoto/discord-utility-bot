import {
    ButtonInteraction,
    MessageButton,
    MessageSelectMenu,
    MessageSelectOptionData,
    SelectMenuInteraction,
} from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { LanguageString } from '../../';
import { MusicClient } from '../client';
import { Queue, QueueOption } from '../entities';
import { AbstractCommand } from '../utils';
import { Languages } from '../translation';

export class Translate extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string {
        return this.translate([
            'music',
            'commands',
            'translate',
            'description',
        ]);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection || !queue.hasOption(QueueOption.Options.EDITING))
            return null;
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'translate', 'label']),
            )
            .setDisabled(Object.keys(Languages).length < 1)
            .setStyle(
                queue.hasOption(QueueOption.Options.TRANSLATE_SELECTED)
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }

    public selectMenu(queue: Queue): MessageSelectMenu | null {
        if (
            !this.connection ||
            !queue.hasOption(QueueOption.Options.TRANSLATE_SELECTED) ||
            !queue.hasOption(QueueOption.Options.EDITING) ||
            Object.keys(Languages).length < 1
        )
            return null;
        const dropdownOptions: MessageSelectOptionData[] = Object.keys(
            Languages,
        ).map((l) => {
            return { label: l, value: l };
        });
        return new MessageSelectMenu({
            placeholder: this.translate([
                'music',
                'commands',
                'translate',
                'dropdown',
                'placeholder',
            ]),
            options: dropdownOptions,
            disabled: false,
            customId: this.id2,
            maxValues: 1,
        });
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (
            !interaction ||
            !interaction.user ||
            interaction.deferred ||
            interaction.replied
        )
            return;
        let queue: Queue | undefined = await this.getQueue();
        if (!queue) return;

        if (queue.hasOption(QueueOption.Options.TRANSLATE_SELECTED)) {
            queue = await queue.removeOptions([
                QueueOption.Options.TRANSLATE_SELECTED,
            ]);
        } else {
            queue = await queue.removeOptions([
                QueueOption.Options.REMOVE_SELECTED,
                QueueOption.Options.FORWARD_SELECTED,
            ]);
            queue = await queue.addOption(
                QueueOption.Options.TRANSLATE_SELECTED,
            );
        }
        queue = await queue.save();

        this.client.emitEvent('queueMessageUpdate', {
            interaction: interaction,
            queue: queue,
        });
    }

    public async executeFromSelectMenu(
        interaction: SelectMenuInteraction,
    ): Promise<void> {
        const queue: Queue | undefined = await this.getQueue();
        if (!queue || interaction.values.length !== 1 || !interaction.guildId)
            return;
        try {
            const lang: string = interaction.values[0];
            this.client.updateGuildLanguage(
                lang as LanguageString,
                interaction.guildId,
            );
        } catch (e) {}
        this.client.emitEvent('queueMessageUpdate', {
            interaction: interaction,
            queue: queue,
            reload: true,
        });
    }
}
