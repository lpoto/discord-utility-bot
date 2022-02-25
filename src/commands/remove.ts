import {
    ButtonInteraction,
    InteractionCollector,
    Message,
    MessageActionRow,
    MessageButton,
    MessageSelectMenu,
    MessageSelectOptionData,
} from 'discord.js';
import {
    InteractionTypes,
    MessageButtonStyles,
} from 'discord.js/typings/enums';
import { MusicClient } from '../client';
import { Queue, Song } from '../entities';
import { AbstractCommand } from '../models';

export class Remove extends AbstractCommand {
    private songsPerPage: number;

    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
        this.songsPerPage = 23;
    }

    get description(): string {
        return this.translate(['music', 'commands', 'remove', 'description']);
    }

    public button(queue: Queue): MessageButton | null {
        if (!this.connection || !queue.options.includes('editing'))
            return null;
        return new MessageButton()
            .setLabel(this.translate(['music', 'commands', 'remove', 'label']))
            .setDisabled(queue.songs.length < 2)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        try {
            if (
                !interaction ||
                !interaction.user ||
                interaction.deferred ||
                interaction.replied
            )
                return;
            const queue: Queue | undefined = await this.getQueue();
            if (!queue) return;

            const removeDropdown: MessageSelectMenu | null = this.removeDropdown(
                queue,
            );
            if (!removeDropdown) return;
            interaction
                .reply({
                    content: this.translate([
                        'music',
                        'commands',
                        'remove',
                        'label',
                    ]),
                    components: [
                        new MessageActionRow().addComponents(removeDropdown),
                    ],
                    ephemeral: true,
                    fetchReply: true,
                })
                .then((message) => {
                    if (!(message instanceof Message) || !message.channel)
                        return;
                    new InteractionCollector(this.client, {
                        channel: message.channel,
                        interactionType: InteractionTypes.MESSAGE_COMPONENT,
                    }).on('collect', async (interaction2) => {
                        if (
                            !interaction2.isSelectMenu() ||
                            interaction2.applicationId !==
                                this.client.user?.id ||
                            !interaction2.customId.startsWith(this.name) ||
                            interaction2.deferred ||
                            interaction2.replied ||
                            interaction2.component.placeholder !==
                                this.translate([
                                    'music',
                                    'commands',
                                    'remove',
                                    'dropdown',
                                    'placeholder',
                                ])
                        )
                            return;
                        let start = 0;
                        const indexes: number[] = [];
                        for (const value of interaction2.values) {
                            try {
                                if (value.startsWith('prev: ')) {
                                    start = Number(
                                        value.replace('prev: ', '').trim(),
                                    );
                                } else if (value.startsWith('next: ')) {
                                    start = Number(
                                        value.replace('next: ', '').trim(),
                                    );
                                } else {
                                    const idx = Number(value);
                                    indexes.push(idx);
                                }
                            } catch (e) {
                                continue;
                            }
                        }
                        await queue.reload();
                        await this.removeIndexes(queue, indexes);
                        this.client.musicActions
                            .updateQueueMessage(queue, false, false, true)
                            .catch((e) =>
                                this.client.handleError(
                                    e,
                                    'remove.ts -> Removing indexes',
                                ),
                            );
                        let removeDd: MessageSelectMenu | null = null;
                        try {
                            removeDd = this.removeDropdown(queue, start);
                        } catch (e) {
                            console.error('Remove dropdown error', e);
                            return;
                        }
                        if (interaction2.deferred || interaction2.replied)
                            return;
                        interaction2
                            .update({
                                content: this.translate([
                                    'music',
                                    'commands',
                                    'remove',
                                    'label',
                                ]),
                                components: !removeDd
                                    ? []
                                    : [
                                          new MessageActionRow().addComponents(
                                              removeDd,
                                          ),
                                      ],
                            })
                            .catch((e) =>
                                this.client.handleError(
                                    e,
                                    'remove.ts -> execute',
                                ),
                            );
                    });
                })
                .catch((e) => {
                    console.log('Error when removing:', e);
                });
        } catch (e) {
            console.error('Error when removing: ', e);
        }
    }

    private removeDropdown(
        queue: Queue,
        start: number = 0,
    ): MessageSelectMenu | null {
        if (queue.songs.length < 2) return null;
        const songs: Song[] = queue.songs.slice(
            start * this.songsPerPage,
            start * this.songsPerPage + this.songsPerPage + 1,
        );
        const dropdownOptions: MessageSelectOptionData[] = songs
            .map((s, index) => {
                const idx: number = index + start * this.songsPerPage;
                let label = `${idx}.\u3000${s.toString()}`;
                if (label.length > 100) label = label.substring(0, 100);
                return {
                    label: label,
                    value: idx.toString(),
                };
            })
            .slice(1);

        if (start > 0) {
            dropdownOptions.push({
                label: '<<',
                value: 'prev: ' + (start - 1).toString(),
            });
        }
        if (
            queue.songs.length - 1 >
            start * this.songsPerPage + dropdownOptions.length
        ) {
            dropdownOptions.push({
                label: '>>',
                value: 'next: ' + (start + 1).toString(),
            });
        }
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
            customId: this.id,
            maxValues:
                dropdownOptions.length < this.songsPerPage
                    ? dropdownOptions.length
                    : this.songsPerPage,
        });
    }

    private async removeIndexes(
        queue: Queue,
        indexes: number[],
    ): Promise<void> {
        try {
            queue.songs = queue.songs.filter(
                (_, idx) => !indexes.includes(idx),
            );
            await queue.save();
        } catch (e) {
            console.error('Error removing songs from queue: ', e);
        }
    }
}
