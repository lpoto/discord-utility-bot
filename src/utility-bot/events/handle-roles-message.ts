import { randomUUID } from 'crypto';
import {
    ButtonInteraction,
    Guild,
    GuildMember,
    Message,
    MessageActionRow,
    MessageButton,
    MessageEmbed,
    MessageSelectMenu,
    MessageSelectOptionData,
    Role,
    SelectMenuInteraction,
    TextBasedChannel,
    TextChannel,
} from 'discord.js';
import { MessageButtonStyles } from 'discord.js/typings/enums';
import { UtilityClient } from '../client';
import { GuildRole, RolesMessage } from '../entities';
import { HandleRolesMessageOptions } from '../utility-bot';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnHandleRolesMessage extends AbstractUtilityEvent {
    public constructor(client: UtilityClient) {
        super(client);
    }

    public async callback(options: HandleRolesMessageOptions): Promise<void> {
        switch (options.type) {
            case 'create':
                return this.createRolesMessage(options);
            case 'update':
                return this.updateRolesMessage(options);
            case 'selectMenu':
                return this.selectRoles(options);
            case 'reply':
                return this.reply(options);
            case 'buttonClick':
                return this.buttonClick(options);
        }
    }

    private async createRolesMessage(
        options: HandleRolesMessageOptions,
    ): Promise<void> {
        if (
            !options.interaction ||
            !(options.interaction.channel instanceof TextChannel)
        )
            return;
        const channel: TextChannel = options.interaction.channel;
        const rm: RolesMessage = RolesMessage.create({
            messageId: '',
            channelId: channel.id,
            color: Math.floor(Math.random() * 16777215),
            guildId: channel.guildId,
            commited: false,
            name: null,
            roles: [],
            offset: 0,
        });
        await options.interaction
            .reply({
                embeds: [await this.rolesMessageEmbed(rm, channel.guild)],
                components: this.getComponents(rm, channel.guild),
                fetchReply: true,
            })
            .then((m) => {
                rm.messageId = m.id;
                rm.save();
            })
            .catch((e: Error) => {
                this.client.emitEvent('error', e);
            });
    }

    private async updateRolesMessage(
        options: HandleRolesMessageOptions,
    ): Promise<void> {
        let rm: RolesMessage | undefined = await RolesMessage.findOne({
            messageId: options.messageId,
        });
        if (!rm) return;
        let channel: TextBasedChannel | null | undefined =
            options.interaction?.channel;
        if (!options.interaction) {
            if (options.repliedMessage)
                channel = options.repliedMessage.channel;
        }
        let message: Message | undefined = undefined;
        if (channel instanceof TextChannel)
            message = await channel.messages
                .fetch(rm.messageId)
                .catch((e: Error) => {
                    this.client.emitEvent('error', e);
                    return undefined;
                });
        if (!message || !(channel instanceof TextChannel)) {
            rm.remove().catch((e: Error) => {
                this.client.emitEvent('error', e);
            });
            return;
        }
        const roles: Role[] = this.editableRoles(channel.guild);
        rm.roles = rm.roles.filter((r) => roles.find((r2) => r2.id === r.id));
        if (rm.offset > roles.length) rm.offset = 0;
        rm = await rm.save();
        if (
            options.interaction &&
            (options.interaction.isButton() ||
                options.interaction.isSelectMenu())
        ) {
            if (
                await options.interaction
                    .update({
                        embeds: [
                            await this.rolesMessageEmbed(rm, channel.guild),
                        ],
                        components: this.getComponents(rm, channel.guild),
                        fetchReply: true,
                    })
                    .then(() => {
                        return true;
                    })
                    .catch(() => {
                        return false;
                    })
            )
                return;
        }
        message
            .edit({
                embeds: [await this.rolesMessageEmbed(rm, channel.guild)],
                components: this.getComponents(rm, channel.guild),
            })
            .catch((e: Error) => {
                this.client.emitEvent('error', e);
            });
    }

    private async buttonClick(
        options: HandleRolesMessageOptions,
    ): Promise<void> {
        if (
            !options.interaction ||
            !(options.interaction instanceof ButtonInteraction) ||
            !options.interaction.component.label
        )
            return;
        if (options.interaction.customId.includes('__'))
            return this.addRemoveRole(options);
        switch (options.interaction.component.label) {
            case '>':
                return this.updateOffset(options);
            case '<':
                return this.updateOffset(options, true);
            case 'commit':
                return this.commit(options);
            default:
                return this.addRemoveRole(options);
        }
    }

    private async reply(options: HandleRolesMessageOptions): Promise<void> {
        if (
            !options.repliedMessage ||
            !options.repliedMessage.member ||
            !(options.repliedMessage.channel instanceof TextChannel)
        )
            return;
        const content: string = options.repliedMessage.content;
        if (['resend', 'enew', 'renew'].includes(content.trim().toLowerCase()))
            return this.resend(options);
        if (['edit', 'reedit', 'open'].includes(content.trim().toLowerCase()))
            return this.reedit(options);
        return this.changeName(options);
    }

    private async selectRoles(
        options: HandleRolesMessageOptions,
    ): Promise<void> {
        if (
            !options.interaction ||
            !(options.interaction instanceof SelectMenuInteraction) ||
            !options.interaction.guild
        )
            return;
        const values: string[] = options.interaction.values;
        const rm: RolesMessage | undefined = await RolesMessage.findOne({
            messageId: options.messageId,
        });
        if (!rm) return;
        const roles: Role[] = this.editableRoles(options.interaction.guild);
        rm.roles = rm.roles.filter((r) => roles.find((r3) => r3.id === r.id));
        for (const v of values) {
            const r: Role | undefined = roles.find((r3) => r3.id === v);
            if (r === undefined) continue;
            const r2: GuildRole | undefined = rm.roles.find(
                (r3) => r3.id === v,
            );
            if (r2 === undefined) {
                rm.roles.push(
                    GuildRole.create({
                        name: r.name,
                        id: r.id,
                    }),
                );
            } else {
                rm.roles = rm.roles.filter((r3) => r3.id !== r.id);
            }
        }
        if (rm.roles.length > 25) rm.roles = rm.roles.slice(0, 25);
        await rm.save();
        await this.updateRolesMessage(options);
    }

    private async updateOffset(
        options: HandleRolesMessageOptions,
        decrement?: boolean,
    ): Promise<void> {
        if (!options.interaction?.guild) return;
        const rm: RolesMessage | undefined = await RolesMessage.findOne({
            messageId: options.messageId,
        });
        const roles: Role[] = this.editableRoles(options.interaction.guild);
        if (!rm) return;
        if (decrement) {
            rm.offset -= RolesMessage.rolesPerPage;
            if (rm.offset < 0) {
                rm.offset = 0;
                while (rm.offset + RolesMessage.rolesPerPage < roles.length)
                    rm.offset += RolesMessage.rolesPerPage;
            }
        } else {
            rm.offset += RolesMessage.rolesPerPage;
            if (rm.offset >= roles.length) rm.offset = 0;
        }
        await rm.save();
        this.updateRolesMessage(options);
    }

    private async changeName(
        options: HandleRolesMessageOptions,
    ): Promise<void> {
        if (
            !options.repliedMessage ||
            !(options.repliedMessage.channel instanceof TextChannel)
        )
            return;
        const rm: RolesMessage | undefined = await RolesMessage.findOne({
            messageId: options.messageId,
        });
        if (!rm) return;
        const name: string = options.repliedMessage.content;
        if (name.length === 0) return;
        await rm.save();
        await this.updateRolesMessage(options);
    }

    private async addRemoveRole(
        options: HandleRolesMessageOptions,
    ): Promise<void> {
        if (
            !options.interaction ||
            !(options.interaction instanceof ButtonInteraction) ||
            !options.interaction.component.label ||
            !options.interaction.member ||
            !(options.interaction.member instanceof GuildMember)
        )
            return;
        this.client.logger.debug('Adding/removing role');
        const c: string[] = options.interaction.customId.split('__');
        if (c.length < 2) return;
        const id: string = c[1];
        const member: GuildMember = options.interaction.member;
        let txt = '';
        if (member.roles.cache.find((r) => r.id === id)) {
            this.client.logger.debug(
                'Removing role',
                options.interaction.component.label,
                'from user',
                member.id,
            );
            txt = 'Added role `' + options.interaction.component.label + '`';
            member.roles.remove(id);
        } else {
            this.client.logger.debug(
                'Adding role',
                options.interaction.component.label,
                'to user',
                member.id,
            );
            member.roles.add(id);
            txt = 'Removed role `' + options.interaction.component.label + '`';
        }
        options.interaction
            .reply({
                content: txt,
                ephemeral: true,
            })
            .catch((e) => this.client.emitEvent('error', e));
    }

    private async commit(options: HandleRolesMessageOptions): Promise<void> {
        const rm: RolesMessage | undefined = await RolesMessage.findOne({
            messageId: options.messageId,
        });
        if (!rm) return;
        if (rm.roles.length === 0) return;
        rm.commited = true;
        await rm.save();
        await this.updateRolesMessage(options);
    }

    private async reedit(options: HandleRolesMessageOptions): Promise<void> {
        const rm: RolesMessage | undefined = await RolesMessage.findOne({
            messageId: options.messageId,
        });
        if (!rm) return;
        rm.commited = false;
        await rm.save();
        await this.updateRolesMessage(options);
    }

    private async resend(options: HandleRolesMessageOptions): Promise<void> {
        if (
            !options.repliedMessage ||
            !(options.repliedMessage.channel instanceof TextChannel)
        )
            return;
        const rm: RolesMessage | undefined = await RolesMessage.findOne({
            messageId: options.messageId,
        });
        if (!rm) return;
        const channel: TextChannel = options.repliedMessage.channel;
        const oldMsg: Message | undefined = await channel.messages
            .fetch(options.messageId)
            .catch((e) => {
                this.client.emitEvent('error', e);
                return undefined;
            });
        if (!oldMsg) return;
        await channel
            .send({
                embeds: [await this.rolesMessageEmbed(rm, channel.guild)],
                components: this.getComponents(rm, channel.guild),
            })
            .then(async (m) => {
                if (m) {
                    rm.messageId = m.id;
                    await rm.save();
                    oldMsg.delete().catch((e) => {
                        this.client.emitEvent('error', e);
                    });
                }
            })
            .catch((e) => {
                this.client.emitEvent('error', e);
            });
    }

    private async rolesMessageEmbed(
        rm: RolesMessage,
        guild: Guild,
    ): Promise<MessageEmbed> {
        if (rm.commited) {
            return new MessageEmbed({
                description: '',
                color: rm.color ? rm.color : undefined,
                title: rm.name ? rm.name : 'Roles',
            });
        }
        return new MessageEmbed({
            title: rm.name ? rm.name : 'Roles',
            color: rm.color ? rm.color : undefined,
            description: this.getRoles(rm.offset, guild, rm).join('\n'),
            footer: { text: 'Select/unselect roles in the dropdown.' },
        });
    }

    private getComponents(rm: RolesMessage, guild: Guild): MessageActionRow[] {
        if (rm.commited) {
            if (rm.roles.length === 0) return [];
            const rows: MessageActionRow[] = [new MessageActionRow()];
            let idx = 0;
            let idx2 = 0;
            for (const r of rm.roles) {
                if (rows[idx2].components.length >= 5) {
                    idx2 += 1;
                    rows.push(new MessageActionRow());
                }
                rows[idx2].addComponents([
                    new MessageButton()
                        .setCustomId(randomUUID().toString() + '__' + r.id)
                        .setStyle(MessageButtonStyles.SECONDARY)
                        .setDisabled(false)
                        .setLabel(r.name),
                ]);
                if (idx >= 25) break;
                idx++;
            }
            return rows;
        }
        let offset: number = rm.offset;
        const roles: Role[] = this.editableRoles(guild);
        if (offset > roles.length) offset = 0;
        const curRoles: MessageSelectOptionData[] = roles
            .slice(offset, offset + RolesMessage.rolesPerPage)
            .map((r) => {
                return {
                    label: r.name,
                    value: r.id,
                };
            });
        return [
            new MessageActionRow().addComponents([
                new MessageButton()
                    .setCustomId(randomUUID())
                    .setLabel('<')
                    .setDisabled(
                        this.editableRoles(guild).length <=
                            RolesMessage.rolesPerPage,
                    )
                    .setStyle(MessageButtonStyles.SECONDARY),
                new MessageButton()
                    .setCustomId(randomUUID())
                    .setLabel('>')
                    .setDisabled(
                        this.editableRoles(guild).length <=
                            RolesMessage.rolesPerPage,
                    )
                    .setStyle(MessageButtonStyles.SECONDARY),
                new MessageButton()
                    .setCustomId(randomUUID())
                    .setLabel('commit')
                    .setDisabled(rm.roles.length === 0)
                    .setStyle(MessageButtonStyles.SECONDARY),
            ]),
            new MessageActionRow().addComponents([
                new MessageSelectMenu()
                    .setCustomId(randomUUID().toString())
                    .setPlaceholder(
                        'Select the roles you want to add or remove.',
                    )
                    .setMaxValues(curRoles.length)
                    .addOptions(curRoles),
            ]),
        ];
    }

    private getRoles(
        offset: number,
        guild: Guild,
        rm: RolesMessage,
    ): string[] {
        const roles: Role[] = this.editableRoles(guild);
        if (offset > roles.length) offset = 0;
        return roles
            .slice(offset, offset + RolesMessage.rolesPerPage)
            .map((r) => {
                if (rm.roles.find((kr) => kr.id === r.id))
                    return '> \u2000->\u3000**' + r.name + '**';
                return '> ' + r.name;
            });
    }

    private editableRoles(guild: Guild): Role[] {
        const highestRole: Role | undefined = guild.me?.roles.highest;
        return guild.roles.cache
            .filter(
                (r) =>
                    (!highestRole || highestRole && (
                        r.comparePositionTo(highestRole) > 0
                    )) &&
                    !r.tags?.botId &&
                    !r.tags?.integrationId &&
                    !r.tags?.premiumSubscriberRole &&
                    r.name !== '@everyone',
            )
            .map((r) => r);
    }
}

export namespace OnHandleRolesMessage {
    export type Type = [
        'handleRolesMessage',
        ...Parameters<OnHandleRolesMessage['callback']>
    ];
}
