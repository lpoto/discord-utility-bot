import {
    ButtonInteraction,
    MessageButton,
    MessageSelectMenu,
    MessageSelectOptionData,
    SelectMenuInteraction,
} from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
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
            .setDisabled(Object.keys(Languages).length < 2)
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
            Object.keys(Languages).length < 2
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
            maxValues: dropdownOptions.length,
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
        if (!queue || queue.size < 3 || interaction.values.length === 0)
            return;
        /*this.client.musicActions.updateQueueMessage({
            interaction: interaction,
            queue: queue,
            reload: true,
        });*/
    }
}
