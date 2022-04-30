import { CommandInteraction, GuildMember } from 'discord.js';
import { UtilityClient } from '../client';
import { AbstractUtilityEvent } from '../utils/abstract-utility-event';

export class OnConfigSlashCommand extends AbstractUtilityEvent {
    public constructor(client: UtilityClient) {
        super(client);
    }

    public async callback(interaction: CommandInteraction): Promise<void> {
        this.eventQueue.addToQueue(interaction.id, () =>
            this.execute(interaction),
        );
    }

    private async execute(interaction: CommandInteraction): Promise<void> {
        if (
            !interaction.guild ||
            !interaction.isCommand() ||
            !interaction.member ||
            !(interaction.member instanceof GuildMember) ||
            !interaction.member.permissions.has('ADMINISTRATOR')
        )
            return;
        const command: string | undefined = interaction.options
            .get('command')
            ?.value?.toString();
        if (!command) return;
        const roleIds: Set<string> = new Set();
        for (let i = 1; i < 4; i++) {
            const r: string | undefined = interaction.options
                .get('role' + i.toString())
                ?.value?.toString();
            if (r) roleIds.add(r);
        }
        await this.client.rolesChecker.setRolesForCommand(
            command,
            interaction.guild.id,
            Array.from(roleIds.values()),
        );
        const txt: string =
            roleIds.size === 0
                ? this.translate(
                      ['utility', 'commands', 'config', 'resetRoles'],
                      command,
                  )
                : this.translate(
                      ['utility', 'commands', 'config', 'changedRoles'],
                      command,
                      Array.from(roleIds.values())
                          .map((rId) =>
                              interaction.guild?.roles.cache
                                  .find((r) => r.id === rId)
                                  ?.name.toString(),
                          )
                          .join(', '),
                  );
        interaction
            .reply({
                content: txt,
            })
            .catch((e) => {
                this.client.emitEvent('error', e);
            });
    }
}

export namespace OnConfigSlashCommand {
    export type Type = [
        'configSlashCommand',
        ...Parameters<OnConfigSlashCommand['callback']>,
    ];
}
