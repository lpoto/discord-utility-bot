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
import { MusicCommandOptions } from '.';
import { Song } from '../song';
import { Command } from './command';

export class Remove extends Command {
    private songsPerPage: number;

    constructor(options: MusicCommandOptions) {
        super(options);
        this.songsPerPage = 23;
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user || !this.music.thread) return;
        const removeDropdown: MessageSelectMenu | null = this.removeDropdown();
        if (!removeDropdown) {
            try {
                interaction.deferReply();
            } catch (e) {
                return;
            }
            return;
        }
        interaction
            .reply({
                content: this.translate([
                    'music',
                    'commands',
                    'actionRow',
                    'remove',
                ]),
                components: [
                    new MessageActionRow().addComponents(removeDropdown),
                ],
                ephemeral: true,
                fetchReply: true,
            })
            .then((message) => {
                if (!(message instanceof Message) || !message.channel) return;
                new InteractionCollector(this.music.client, {
                    channel: message.channel,
                    interactionType: InteractionTypes.MESSAGE_COMPONENT,
                }).on('collect', (interaction2) => {
                    if (
                        !interaction2.isSelectMenu() ||
                        interaction2.applicationId !==
                            this.music.client.user?.id ||
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
                                this.music.queue?.removeByIndex(idx);
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                    this.music.actions.updateQueueMessage();
                    const removeDd: MessageSelectMenu | null =
                        this.removeDropdown(start);
                    if (!removeDd) return;
                    try {
                        interaction2.update({
                            content: this.translate([
                                'music',
                                'commands',
                                'actionRow',
                                'remove',
                            ]),
                            components: [
                                new MessageActionRow().addComponents(removeDd),
                            ],
                        });
                    } catch (e) {
                        return;
                    }
                });
            });
    }

    private removeDropdown(start: number = 0): MessageSelectMenu | null {
        if (!this.music.queue || this.music.queue.size < 2) return null;
        const songs: Song[] = this.music.queue.allSongs
            .slice(1)
            .slice(
                start * this.songsPerPage,
                start * this.songsPerPage + this.songsPerPage,
            );
        const dropdownOptions: MessageSelectOptionData[] = songs.map(
            (s, index) => {
                return {
                    label:
                        `${index + start * this.songsPerPage + 1}.\u3000` +
                        s.toString(),
                    value: (index + 1).toString(),
                };
            },
        );
        if (start > 0) {
            dropdownOptions.push({
                label: '<<',
                value: 'prev: ' + (start - 1).toString(),
            });
        }
        if (
            this.music.queue.size - 1 >
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

    get button(): MessageButton | null {
        if (!this.music.editing) return null;
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'actionRow', 'remove']),
            )
            .setDisabled(!this.music.queue || this.music.queue?.size < 2)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }
}
