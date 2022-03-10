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
import { Queue } from '../entities';
import { AbstractCommand } from '../models';
import { Languages } from '../translation';

export class Translate extends AbstractCommand {
    private option: string;

    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
        this.option = 'translateSelected';
    }

    get description(): string {
        return this.translate([
            'music',
            'commands',
            'translate',
            'description',
        ]);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection || !queue.options.includes('editing'))
            return null;
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'translate', 'label']),
            )
            .setDisabled(Object.keys(Languages).length < 1)
            .setStyle(
                queue.options.includes(this.option)
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }

    public selectMenu(queue: Queue): MessageSelectMenu | null {
        if (
            !this.connection ||
            !queue.options.includes(this.option) ||
            !queue.options.includes('editing') ||
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
        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        if (queue.options.includes(this.option)) {
            queue.options = queue.options.filter((o) => o !== this.option);
        } else {
            queue.options = queue.options.filter(
                (o) => !['removeSelected', 'forwardSelected'].includes(o),
            );
            queue.options.push(this.option);
        }
        await queue.save();
        this.client.musicActions.updateQueueMessage({
            interaction: interaction,
            queue: queue,
            componentsOnly: true,
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
        this.client.musicActions.updateQueueMessage({
            interaction: interaction,
            queue: queue,
            reload: true,
        });
    }
}
