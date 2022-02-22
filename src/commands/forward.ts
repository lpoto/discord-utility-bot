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

export class Forward extends AbstractCommand {
    private songsPerPage: number;

    constructor(client: MusicClient, guildId: string) {
        super(client, guildId);
        this.songsPerPage = 23;
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
            .setDisabled(queue.songs.length < 2)
            .setStyle(MessageButtonStyles.SECONDARY)
            .setCustomId(this.id);
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

        const forwardDropdown: MessageSelectMenu | null =
            this.forwardDropdown(queue);
        if (!forwardDropdown) return;
        interaction
            .reply({
                content: this.translate([
                    'music',
                    'commands',
                    'forward',
                    'label',
                ]),
                components: [
                    new MessageActionRow().addComponents(forwardDropdown),
                ],
                ephemeral: true,
                fetchReply: true,
            })
            .then((message) => {
                if (!(message instanceof Message) || !message.channel) return;
                new InteractionCollector(this.client, {
                    channel: message.channel,
                    interactionType: InteractionTypes.MESSAGE_COMPONENT,
                }).on('collect', async (interaction2) => {
                    if (
                        !interaction2.isSelectMenu() ||
                        interaction2.applicationId !== this.client.user?.id ||
                        !interaction2.customId.startsWith(this.name) ||
                        interaction2.deferred ||
                        interaction2.replied ||
                        interaction2.component.placeholder !==
                            this.translate([
                                'music',
                                'commands',
                                'forward',
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
                    await this.forwardIndexes(queue, indexes);
                    this.client.musicActions.updateQueueMessage(
                        queue,
                        true,
                        false,
                        true,
                    );
                    const forwardDd: MessageSelectMenu | null =
                        this.forwardDropdown(queue, start);
                    if (interaction2.deferred || interaction2.replied) return;
                    try {
                        interaction2.update({
                            content: this.translate([
                                'music',
                                'commands',
                                'forward',
                                'label',
                            ]),
                            components: !forwardDd
                                ? []
                                : [
                                      new MessageActionRow().addComponents(
                                          forwardDd,
                                      ),
                                  ],
                        });
                    } catch (e) {
                        return;
                    }
                });
            })
            .catch((e) => {
                console.log('Error when removing:', e);
            });
    }

    private forwardDropdown(
        queue: Queue,
        start: number = 0,
    ): MessageSelectMenu | null {
        if (queue.songs.length < 2) return null;
        const songs: Song[] = queue.songs.slice(
            start * this.songsPerPage,
            start * this.songsPerPage + this.songsPerPage,
        );
        const dropdownOptions: MessageSelectOptionData[] = songs
            .map((s, index) => {
                return {
                    label:
                        `${index + start * this.songsPerPage}.\u3000` +
                        s.toString(),
                    value: s.position.toString(),
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
                'forward',
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

    private async forwardIndexes(
        queue: Queue,
        positions: number[],
    ): Promise<void> {
        if (queue.songs.length < 2) return;
        let idx = 1;
        let idx2: number = positions.length + 1;
        let minPos: number = Math.min.apply(
            null,
            queue.songs.map((s) => s.position),
        );
        for (const song of queue.songs) {
            if (song.position === minPos) {
                minPos = 0;
                song.position = minPos;
            } else if (positions.includes(song.position)) {
                song.position = idx;
                idx++;
            } else {
                song.position = idx2;
                idx2++;
            }
        }
        await queue.save();
    }
}
