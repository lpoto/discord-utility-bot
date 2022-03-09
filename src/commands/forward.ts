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

export class Forward extends AbstractCommand {
    private option: string;

    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
        this.option = 'forwardSelected';
    }

    get description(): string {
        return this.translate(['music', 'commands', 'forward', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection || !queue.options.includes('editing'))
            return null;
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'forward', 'label']),
            )
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
        const queue: Queue | undefined = await this.getQueue();
        if (!queue) return;
        if (queue.options.includes(this.option)) {
            queue.options = queue.options.filter((o) => o !== this.option);
        } else {
            queue.options = queue.options.filter(
                (o) => o !== 'removeSelected',
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

        let minIdx: number =
            (queue.headSong ? queue.headSong.position : 0) -
            interaction.values.length +
            1;

        if (queue.headSong)
            queue.headSong.position -= interaction.values.length;
        await queue.headSong?.save();

        for await (const i of interaction.values) {
            const s: Song = queue.curPageSongs[Number(i)];
            s.position = minIdx;
            minIdx++;
            await s.save();
        }
        if (queue.headSong) queue.headSong.position--;
        await queue.headSong?.save();

        this.client.musicActions.updateQueueMessage({
            interaction: interaction,
            queue: queue,
            reload: true,
        });
    }
}
