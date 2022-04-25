import {
    ButtonInteraction,
    CommandInteraction,
    MessageButton,
    MessageSelectMenu,
    SelectMenuInteraction,
} from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractClientEvent } from '../utils/abstract-client-event';
import * as Commands from '../commands';
import { Command, CommandName, ExecuteCommandOptions } from '../music-bot';
import { ActiveCommandsOptions } from '../utils';

export class OnExecuteCommand extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(options: ExecuteCommandOptions): Promise<void> {
        if (options.name && (options.interaction?.guildId || options.guildId))
            return this.execute(
                options.name,
                options.guildId
                    ? options.guildId
                    : options.interaction!.guildId!,
                options.interaction instanceof ButtonInteraction ||
                    options.interaction instanceof CommandInteraction
                    ? options.interaction
                    : undefined,
            );
        if (
            options.interaction &&
            options.interaction instanceof SelectMenuInteraction
        )
            return this.executeMenuSelectFromInteraction(options.interaction);
        if (
            options.interaction &&
            options.interaction instanceof ButtonInteraction
        )
            return this.executeFromInteraction(options.interaction);
    }

    private execute(
        name: CommandName,
        guildId: string,
        interaction?: ButtonInteraction | CommandInteraction,
    ) {
        const command: Command | null = this.getCommand(name, guildId);
        if (!command) return;
        command.execute(interaction).catch((e) => {
            this.client.emitEvent('error', e);
        });
    }

    private async executeFromInteraction(
        interaction: ButtonInteraction,
    ): Promise<void> {
        if (!interaction.guildId || !this.client.user) return;
        const queue: Queue | undefined = await Queue.findOne({
            guildId: interaction.guildId,
            clientId: this.client.user.id,
        });
        if (!queue) return;
        const guildId: string = queue.guildId;

        for (const val in Commands) {
            try {
                const command: Command | null = this.getCommand(
                    val,
                    interaction.guildId,
                );
                if (!command) continue;
                const button: MessageButton | null = command.button2(queue);
                if (!button) continue;
                if (
                    interaction.component &&
                    button.label &&
                    interaction.component.label === button.label
                ) {
                    const name: CommandName = command.name as CommandName;
                    if (!command.alwaysExecute) {
                        if (
                            this.client.activeCommandsOptions.hasDeferOption(
                                name,
                                guildId,
                            )
                        ) {
                            this.client.activeCommandsOptions.addToDeferOption(
                                name,
                                guildId,
                                interaction,
                            );
                            return;
                        }
                        this.client.activeCommandsOptions.addToDeferOption(
                            name,
                            guildId,
                        );
                    }

                    const timeout: NodeJS.Timeout = setTimeout(async () => {
                        return command
                            .execute(interaction)
                            .then(() => {
                                const t: NodeJS.Timeout = setTimeout(() => {
                                    if (!command.needsDefer) return;
                                    const o: ActiveCommandsOptions =
                                        this.client.activeCommandsOptions;
                                    o.deferInteractions(name, guildId, true);
                                }, 100);
                                t.unref();
                            })
                            .catch((e) => {
                                this.client.emitEvent('error', e);
                                const options: ActiveCommandsOptions =
                                    this.client.activeCommandsOptions;
                                options.deferInteractions(name, guildId, true);
                            });
                    }, command.interactionTimeout);
                    timeout.unref();
                    return;
                }
            } catch (e) {
                console.error(e);
            }
        }
    }

    private async executeMenuSelectFromInteraction(
        interaction: SelectMenuInteraction,
    ): Promise<void> {
        if (!interaction.guildId || !this.client.user) return;
        const queue: Queue | undefined = await Queue.findOne({
            guildId: interaction.guildId,
            clientId: this.client.user.id,
        });
        if (!queue) return;
        for (const val in Commands) {
            try {
                const command: Command | null = this.getCommand(
                    val,
                    interaction.guildId,
                );
                if (!command) continue;
                const dropdown: MessageSelectMenu | null =
                    command.selectMenu(queue);
                if (!dropdown) continue;
                if (
                    interaction.component &&
                    dropdown.placeholder &&
                    interaction.customId.split('||')[0].trim() === val
                )
                    return command
                        .executeFromSelectMenu(interaction)
                        .catch((e) => {
                            console.error('Error when executing command');
                            this.client.emitEvent('error', e);
                        });
            } catch (e) {
                console.error(e);
            }
        }
    }

    private getCommand(val: string, guildId: string): Command | null {
        return new (<any>Commands)[val](this.client, guildId);
    }
}

export namespace OnExecuteCommand {
    export type Type = [
        'executeCommand',
        ...Parameters<OnExecuteCommand['callback']>
    ];
}
