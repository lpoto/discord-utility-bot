import { GuildMember, Role } from 'discord.js';
import {
    CheckMemberDefaultRolesOptions,
    CheckMemberRolesForCommandOptions,
} from '../..';
import { CommandRolesConfig } from '../common-entities';
import { CustomClient } from './custom-client';

export class RolesChecker {
    private requiredDefaultRoles: string[];
    private client: CustomClient;

    public constructor(client: CustomClient, requiredDefaultRoles?: string[]) {
        if (requiredDefaultRoles)
            this.requiredDefaultRoles = requiredDefaultRoles;
        else this.requiredDefaultRoles = [];
        this.client = client;
    }

    public get defaultRoles(): string[] {
        return this.requiredDefaultRoles;
    }

    public checkMemberDefaultRoles(
        options: CheckMemberDefaultRolesOptions,
    ): boolean {
        const valid: boolean =
            options.member.roles.cache.find((r: Role) =>
                this.requiredDefaultRoles.includes(r.name),
            ) !== undefined;
        if (!valid) {
            this.client.notify({
                warn: true,
                content: this.client.translate(
                    ['common', 'errors', 'missingRolesAll'],
                    this.requiredDefaultRoles.join(', '),
                ),
                ephemeral: true,
                interaction: options.interaction,
                channelId: options.channelId,
            });
        }
        return valid;
    }

    public async checkMemberRolesForCommand(
        options: CheckMemberRolesForCommandOptions,
    ): Promise<boolean> {
        let valid = false;
        if (
            !this.client.user ||
            !(options.member instanceof GuildMember) ||
            options.member.permissions.has('ADMINISTRATOR')
        )
            valid = true;
        this.client.logger.debug(
            `Checking roles for command '${options.command}'`,
            `for member '${options.member.id}'`,
            `in guild '${options.member.guild.id}'`,
        );
        if (
            !valid &&
            this.client.user &&
            options.member instanceof GuildMember
        ) {
            let crc: CommandRolesConfig | undefined =
                await CommandRolesConfig.findOne({
                    guildId: options.member.guild.id,
                    clientId: this.client.user.id,
                    name: options.command,
                }).catch((e: Error) => {
                    this.client.emitEvent('error', e);
                    return undefined;
                });
            if (!crc) return true;
            await crc.filterRoles(this.client);
            crc = await crc.save();
            const memberRoles: string[] = options.member.roles.cache.map(
                (r) => r.id,
            );
            for (const r of crc.roleIds)
                if (memberRoles.includes(r)) {
                    valid = true;
                    break;
                }
            let cId: string | undefined | null = undefined;
            if (options.channelId) cId = options.channelId;
            else if (options.message) cId = options.message.channelId;
            else if (options.interaction) cId = options.interaction.channelId;
            if (!cId) cId = '';
            if (!valid) {
                this.client.notify({
                    warn: true,
                    interaction: options.interaction,
                    message: options.message,
                    channelId: options.channelId,
                    ephemeral: true,
                    content: this.client.translate(
                        ['common', 'errors', 'missingRolesAny'],
                        crc.roleIds
                            .map((rId) => {
                                return options.member.guild.roles.cache.find(
                                    (r: Role) => r.id === rId,
                                )?.name;
                            })
                            .join(', '),
                    ),
                    member: options.member
                        ? options.member
                        : options.message?.member,
                    notificationName: 'missingRoles' + cId,
                    notificationMinutesToPersist: 1,
                });
            }
        }
        if (valid)
            this.client.logger.debug(
                `Member '${options.member.id}'`,
                'has the required roles',
            );
        else
            this.client.logger.debug(
                `Member '${options.member.id}'`,
                'does not have the required roles',
            );
        return valid;
    }

    public async setRolesForCommand(
        command: string,
        guildId: string,
        roleIds: string[],
    ): Promise<void> {
        if (!this.client.user) return;
        let crc: CommandRolesConfig | undefined =
            await CommandRolesConfig.findOne({
                guildId: guildId,
                clientId: this.client.user.id,
                name: command,
            }).catch((e: Error) => {
                this.client.emitEvent('error', e);
                return undefined;
            });
        if (!crc) {
            crc = CommandRolesConfig.create({
                guildId: guildId,
                clientId: this.client.user.id,
                name: command,
                roleIds: roleIds,
            });
            await crc.save();
            return;
        }
        crc.roleIds = roleIds;
        await crc.save();
    }

    public async getRolesForCommand(
        command: string,
        guildId: string,
    ): Promise<string[]> {
        if (!this.client.user) return [];
        const crc: CommandRolesConfig | undefined =
            await CommandRolesConfig.findOne({
                guildId: guildId,
                clientId: this.client.user.id,
                name: command,
            }).catch((e: Error) => {
                this.client.emitEvent('error', e);
                return undefined;
            });
        if (!crc) return [];
        return crc.roleIds;
    }
}
