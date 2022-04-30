import { GuildMember, Role } from 'discord.js';
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

    public checkMemberDefaultRoles(member: GuildMember): boolean {
        return (
            member.roles.cache.find((r: Role) =>
                this.requiredDefaultRoles.includes(r.name),
            ) !== undefined
        );
    }
}
