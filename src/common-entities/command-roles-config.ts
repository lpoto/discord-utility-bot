import { Guild } from 'discord.js';
import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';
import { CustomClient } from '../utils';

@Entity('command_roles_config')
export class CommandRolesConfig extends BaseEntity {
    @PrimaryColumn()
    public guildId: string;

    @PrimaryColumn()
    public clientId: string;

    @PrimaryColumn()
    public name: string;

    @Column('text', { array: true, default: [], nullable: false })
    public roleIds: string[];

    public async filterRoles(client: CustomClient): Promise<void> {
        const guild: Guild | undefined = await client.guilds
            .fetch(this.guildId)
            .catch((e: Error) => {
                client.emitEvent('error', e);
                return undefined;
            });
        if (!guild) return;
        this.roleIds = this.roleIds.filter(
            async (rId) => (await guild.roles.fetch(rId)) !== null,
        );
    }
}
