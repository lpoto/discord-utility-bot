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

export class Forward extends Command {
    private songsPerPage: number;

    constructor(options: MusicCommandOptions) {
        super(options);
        this.songsPerPage = 23;
    }

    public async execute(interaction?: ButtonInteraction): Promise<void> {
        if (!interaction || !interaction.user || !this.music.thread) return;
        const forwardDropdown: MessageSelectMenu | null =
            this.forwardDropdown();
        if (!forwardDropdown) {
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
                    'forward',
                ]),
                components: [
                    new MessageActionRow().addComponents(forwardDropdown),
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
                        !interaction2.customId.startsWith(this.name) ||
                        interaction2.deferred ||
                        interaction2.component.placeholder !==
                            this.translate([
                                'music',
                                'commands',
                                'forward',
                                'dropdown',
                                'placeholder',
                            ]) ||
                        interaction2.values.length !== 1
                    )
                        return;
                    let start = 0;
                    const value: string = interaction2.values[0];
                    try {
                        if (value.startsWith('prev: ')) {
                            start = Number(value.replace('prev: ', '').trim());
                        } else if (value.startsWith('next: ')) {
                            start = Number(value.replace('next: ', '').trim());
                        } else {
                            this.music.queue?.forwardByIndex(Number(value));
                            this.music.actions.updateQueueMessage();
                        }
                    } catch (e) {
                        return;
                    }
                    try {
                        const forwardDd: MessageSelectMenu | null =
                            this.forwardDropdown(start);
                        if (!forwardDd) return;
                        interaction2.update({
                            content: this.translate([
                                'music',
                                'commands',
                                'actionRow',
                                'forward',
                            ]),
                            components: [
                                new MessageActionRow().addComponents(
                                    forwardDd,
                                ),
                            ],
                        });
                    } catch (e) {
                        return;
                    }
                });
            });
    }

    private forwardDropdown(start: number = 0): MessageSelectMenu | null {
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
                'forward',
                'dropdown',
                'placeholder',
            ]),
            options: dropdownOptions,
            disabled: false,
            customId: this.id,
            maxValues: 1,
        });
    }

    get button(): MessageButton | null {
        if (!this.music.editing) return null;
        return new MessageButton()
            .setLabel(
                this.translate(['music', 'commands', 'actionRow', 'forward']),
            )
            .setDisabled(!this.music.queue || this.music.queue?.size < 3)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
    }
}
