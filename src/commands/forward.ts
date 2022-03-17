import {
    ButtonInteraction,
    MessageButton,
    MessageSelectMenu,
    MessageSelectOptionData,
    SelectMenuInteraction,
} from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue, Song, QueueOption } from '../entities';
import { AbstractCommand } from '../utils';

export class Forward extends AbstractCommand {
    public constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
    }

    public get description(): string {
        return this.translate(['music', 'commands', 'forward', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection || !queue.hasOption(QueueOption.Options.EDITING))
            return null;
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'forward', 'label']),
            )
            .setDisabled(queue.size < 3)
            .setStyle(
                queue.hasOption(QueueOption.Options.FORWARD_SELECTED)
                    ? MessageButtonStyles.SUCCESS
                    : MessageButtonStyles.SECONDARY,
            )
            .setCustomId(this.id);
    }

    public selectMenu(queue: Queue): MessageSelectMenu | null {
        if (
            !this.connection ||
            !queue.hasOption(QueueOption.Options.FORWARD_SELECTED) ||
            !queue.hasOption(QueueOption.Options.EDITING) ||
            queue.curPageSongs.length < 1 ||
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
                'forward',
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
        let queue: Queue | undefined = await this.getQueue();
        if (!queue) return;

        if (queue.hasOption(QueueOption.Options.FORWARD_SELECTED)) {
            queue = await queue.removeOptions([
                QueueOption.Options.FORWARD_SELECTED,
            ]);
        } else {
            queue = await queue.removeOptions([
                QueueOption.Options.REMOVE_SELECTED,
                QueueOption.Options.TRANSLATE_SELECTED,
            ]);
            queue = await queue.addOption(
                QueueOption.Options.FORWARD_SELECTED,
            );
        }
        queue = await queue.save();

        this.client.emitEvent('queueMessageUpdate', {
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

        let idx: number = (await Song.minPosition()) - 1;

        for await (const i of interaction.values) {
            const s: Song = queue.curPageSongs[Number(i)];
            s.position = idx;
            idx--;
            await s.save();
        }

        if (queue.headSong) queue.headSong.position = idx;
        await queue.headSong?.save();

        this.client.emitEvent('queueMessageUpdate', {
            interaction: interaction,
            queue: queue,
            reload: true,
        });
    }
}
