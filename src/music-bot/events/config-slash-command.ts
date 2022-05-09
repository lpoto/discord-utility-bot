import { CommandInteraction, GuildMember } from 'discord.js';
import { MusicClient } from '../client';
import { AbstractMusicEvent } from '../utils/abstract-music-event';

export class OnConfigSlashCommand extends AbstractMusicEvent {
    public constructor(client: MusicClient) {
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
                ? this.client.translate(
                      ['music', 'commands', 'config', 'resetRoles'],
                      command,
                  )
                : this.client.translate(
                      ['music', 'commands', 'config', 'changedRoles'],
                      command,
                      Array.from(roleIds.values())
                          .map((rId) =>
                              interaction.guild?.roles.cache
                                  .find((r) => r.id === rId)
                                  ?.name.toString(),
                          )
                          .join(', '),
                  );
        this.client.notify({
            content: txt,
            interaction: interaction,
        });
    }
}

export namespace OnConfigSlashCommand {
    export type Type = [
        'configSlashCommand',
        ...Parameters<OnConfigSlashCommand['callback']>,
    ];
}
