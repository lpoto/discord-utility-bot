import {
    ButtonInteraction,
    CommandInteraction,
    GuildMember,
    Message,
    MessageButton,
    MessageSelectMenu,
    PartialMessage,
    SelectMenuInteraction,
} from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import * as Commands from '../commands';
import { Command, CommandName, ExecuteCommandOptions } from '../music-bot';
import { ActiveCommandsOptions } from '../utils';
import { AbstractMusicEvent } from '../utils/abstract-music-event';
import { RolesChecker } from '../../utils';

export class OnExecuteCommand extends AbstractMusicEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(options: ExecuteCommandOptions): Promise<void> {
        if (
            options.name &&
            (options.interaction?.guildId ||
                options.guildId ||
                options.message ||
                options.member?.guild.id)
        )
            return this.execute(options);
        if (
            options.interaction &&
            options.interaction instanceof SelectMenuInteraction
        )
            return this.executeMenuSelectFromInteraction(options);
        if (
            options.interaction &&
            options.interaction instanceof ButtonInteraction
        )
            return this.executeFromInteraction(options);
    }

    private async execute(options: ExecuteCommandOptions) {
        let guildId: string | undefined | null = undefined;
        if (options.guildId) guildId = options.guildId;
        else if (options.message) guildId = options.message.guildId;
        else if (options.member && options.member.guild)
            guildId = options.member.guild.id;
        else if (options.interaction) guildId = options.interaction.guildId;
        if (!guildId || !options.name) return;

        const command: Command | null = this.getCommand(options.name, guildId);
        if (!command) return;
        if (command.checkMemberPerms) {
            if (
                options.interaction &&
                !options.doNotValidate &&
                !this.client.permsChecker.validateMemberVoice(
                    options.interaction,
                )
            )
                return;

            if (
                options.message &&
                !options.doNotValidate &&
                !this.client.permsChecker.validateMemberVoiceFromThread(
                    options.message,
                )
            )
                return;
        }
        let joined = false;
        let member: GuildMember | undefined | null = undefined;
        if (options.member) member = options.member;
        else if (
            options.interaction &&
            options.interaction.member instanceof GuildMember
        )
            member = options.interaction.member;
        const rolesChecker: RolesChecker = this.client.rolesChecker;
        if (
            command.checkRolesFor &&
            member &&
            !options.doNotValidate &&
            !(await rolesChecker.checkMemberRolesForCommand({
                member: member,
                command: command.checkRolesFor,
                interaction: options.interaction,
                channelId: options.interaction?.channelId,
                message: options.message,
            }))
        )
            return;

        if (!joined && options.interaction && command.joinVoice) {
            this.client.emitEvent('joinVoiceRequest', options.interaction);
        } else if (
            joined &&
            options.message &&
            command.joinVoice &&
            options.message instanceof Message
        ) {
            this.client.emitEvent('joinVoiceRequest', options.message);
        }

        setTimeout(
            () => {
                let arg:
                    | ButtonInteraction
                    | CommandInteraction
                    | SelectMenuInteraction
                    | Message
                    | PartialMessage
                    | undefined = undefined;
                if (options.interaction) arg = options.interaction;
                else if (options.message) arg = options.message;
                command.execute(arg).catch((e) => {
                    this.client.emitEvent('error', e);
                });
            },
            joined ? 0 : 500,
        );
        joined = true;
    }

    private async executeFromInteraction(
        options: ExecuteCommandOptions,
    ): Promise<void> {
        if (!options.interaction || !options.interaction.isButton()) return;
        const interaction: ButtonInteraction = options.interaction;
        if (!interaction.guildId || !this.client.user) return;
        const queue: Queue | undefined = await Queue.findOne({
            guildId: interaction.guildId,
            clientId: this.client.user.id,
        });
        if (!queue) return;
        const guildId: string = queue.guildId;
        let joined = false;

        for (const val in Commands) {
            try {
                const command: Command | null = this.getCommand(
                    val,
                    interaction.guildId,
                );
                if (!command) continue;
                const button: MessageButton | null = command.button2(queue);
                if (
                    !button ||
                    !button.label ||
                    button.label !== interaction.component.label
                )
                    continue;
                if (
                    command.checkMemberPerms &&
                    !this.client.permsChecker.validateMemberVoice(interaction)
                )
                    return;
                const rolesChecker: RolesChecker = this.client.rolesChecker;
                if (
                    command.checkRolesFor &&
                    !(await rolesChecker.checkMemberRolesForCommand({
                        member: interaction.member,
                        command: command.checkRolesFor,
                        interaction: interaction,
                        channelId: interaction.channelId,
                    }))
                )
                    return;
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

                if (!joined && command.joinVoice) {
                    this.client.emitEvent('joinVoiceRequest', interaction);
                }

                const timeout: NodeJS.Timeout = setTimeout(
                    async () => {
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
                                const opts: ActiveCommandsOptions =
                                    this.client.activeCommandsOptions;
                                opts.deferInteractions(name, guildId, true);
                            });
                    },
                    joined
                        ? command.interactionTimeout
                        : command.interactionTimeout + 350,
                );
                timeout.unref();

                joined = true;
                return;
            } catch (e) {
                console.error(e);
            }
        }
    }

    private async executeMenuSelectFromInteraction(
        options: ExecuteCommandOptions,
    ): Promise<void> {
        if (!(options.interaction instanceof SelectMenuInteraction)) return;
        const interaction: SelectMenuInteraction = options.interaction;

        if (!interaction.guildId || !this.client.user) return;
        const queue: Queue | undefined = await Queue.findOne({
            guildId: interaction.guildId,
            clientId: this.client.user.id,
        });
        if (!queue) return;
        let joined = false;
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
                    !interaction.component ||
                    !dropdown.placeholder ||
                    interaction.customId.split('||')[0].trim() !== val
                )
                    return;
                if (
                    command.checkMemberPerms &&
                    !this.client.permsChecker.validateMemberVoice(interaction)
                )
                    return;
                const rolesChecker: RolesChecker = this.client.rolesChecker;
                if (
                    command.checkRolesFor &&
                    !(await rolesChecker.checkMemberRolesForCommand({
                        member: interaction.member,
                        command: command.checkRolesFor,
                        interaction: interaction,
                        channelId: interaction.channelId,
                    }))
                )
                    return;
                if (!joined) {
                    this.client.emitEvent('joinVoiceRequest', interaction);
                }
                setTimeout(
                    () => {
                        command
                            .executeFromSelectMenu(interaction)
                            .catch((e) => {
                                console.error('Error when executing command');
                                this.client.emitEvent('error', e);
                            });
                    },
                    joined ? 0 : 300,
                );
                joined = true;
                return;
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
        ...Parameters<OnExecuteCommand['callback']>,
    ];
}
