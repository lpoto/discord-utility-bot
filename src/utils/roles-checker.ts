import {
    ButtonInteraction,
    CommandInteraction,
    GuildMember,
    Role,
    SelectMenuInteraction,
} from 'discord.js';
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
        member: GuildMember,
        interaction?:
            | ButtonInteraction
            | SelectMenuInteraction
            | CommandInteraction,
        channelId?: string,
    ): boolean {
        const valid: boolean =
            member.roles.cache.find((r: Role) =>
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
                interaction: interaction,
                channelId: channelId,
            });
        }
        return valid;
    }

    public async checkMemberRolesForCommand(
        member: any,
        command: string,
        interaction?:
            | ButtonInteraction
            | SelectMenuInteraction
            | CommandInteraction,
        channelId?: string,
    ): Promise<boolean> {
        if (
            !this.client.user ||
            !(member instanceof GuildMember) ||
            member.permissions.has('ADMINISTRATOR')
        )
            return true;
        let crc: CommandRolesConfig | undefined =
            await CommandRolesConfig.findOne({
                guildId: member.guild.id,
                clientId: this.client.user.id,
                name: command,
            }).catch((e: Error) => {
                this.client.emitEvent('error', e);
                return undefined;
            });
        if (!crc) return true;
        await crc.filterRoles(this.client);
        crc = await crc.save();
        const valid: boolean =
            crc.roleIds.length === 0 ||
            crc.roleIds.some((r) => {
                member.roles.cache.has(r);
            });
        if (!valid) {
            this.client.notify({
                warn: true,
                interaction: interaction,
                channelId: channelId,
                ephemeral: true,
                content: this.client.translate(
                    ['common', 'errors', 'missingRolesAny'],
                    crc.roleIds
                        .map((rId) => {
                            return member.guild.roles.cache.find(
                                (r) => r.id === rId,
                            )?.name;
                        })
                        .join(', '),
                ),
            });
        }
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
