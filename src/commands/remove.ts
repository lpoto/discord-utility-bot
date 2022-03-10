import {
    ButtonInteraction,
    MessageButton,
    MessageSelectMenu,
    MessageSelectOptionData,
    SelectMenuInteraction,
} from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue, Song } from '../entities';
import { AbstractCommand } from '../models';

export class Remove extends AbstractCommand {
    private option: string;

    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
        this.option = 'removeSelected';
    }

    get description(): string {
        return this.translate(['music', 'commands', 'remove', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection || !queue.options.includes('editing'))
            return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'remove', 'label']))
            .setDisabled(queue.size < 3)
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
            queue.size < 3
        )
            return null;
        const dropdownOptions: MessageSelectOptionData[] =
            queue.curPageSongs.map((s, index) => {
                const idx: number = index + queue.offset + 1;
                let label = `${idx}.\u3000${s.name}`;
                if (label.length > 100) label = label.substring(0, 100);
                return { label: label, value: index.toString() };
            });
        return new MessageSelectMenu({
            placeholder: this.translate([
                'music',
                'commands',
                'remove',
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
                (o) => !['forwardSelected', 'translateSelected'].includes(o),
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
        if (!queue || queue.size < 2 || interaction.values.length === 0)
            return;
        for await (const i of interaction.values) {
            const s: Song = queue.curPageSongs[Number(i)];
            await s.remove();
        }
        this.client.musicActions.updateQueueMessage({
            interaction: interaction,
            queue: queue,
            reload: true,
        });
    }
}
