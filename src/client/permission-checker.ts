import {
    CommandInteraction,
    GuildMember,
    PermissionResolvable,
    Role,
    TextBasedChannel,
    TextChannel,
    ThreadChannel,
    VoiceBasedChannel,
    VoiceChannel,
} from 'discord.js';
import { Music } from '../music';
import { MusicClient } from './client';

export class PermissionChecker {
    private voicePermissions: PermissionResolvable[];
    private textPermissions: PermissionResolvable[];
    private roleNames: string[];
    private client: MusicClient;

    constructor(
        voicePermissions: PermissionResolvable[],
        textPermissions: PermissionResolvable[],
        roleNames: string[],
        client: MusicClient,
    ) {
        this.voicePermissions = voicePermissions;
        this.textPermissions = textPermissions;
        this.roleNames = roleNames;
        this.client = client;
    }

    get roles(): string[] {
        return this.roleNames;
    }

    public checkMemberRoles(member: GuildMember): boolean {
        return (
            member.roles.cache.find((r: Role) =>
                this.roleNames.includes(r.name),
            ) !== undefined
        );
    }

    public checkClientVoice(channel: VoiceBasedChannel): boolean {
        if (!channel.guild || !channel.guild.me) return true;
        const member: GuildMember = channel.guild.me;
        return this.voicePermissions.every((p) =>
            channel.permissionsFor(member).has(p),
        );
    }

    public checkClientText(channel: TextBasedChannel): boolean {
        if (
            !(
                channel instanceof TextChannel ||
                channel instanceof ThreadChannel
            ) ||
            !channel.guild ||
            !channel.guild.me
        )
            return true;
        const member: GuildMember = channel.guild.me;
        return this.textPermissions.every((p) =>
            channel.permissionsFor(member).has(p),
        );
    }

    public async validateMemberVoice(
        interaction: CommandInteraction,
        music: Music | null = null,
    ): Promise<boolean> {
        if (
            !interaction.guild ||
            !interaction.guildId ||
            !interaction.guild.me ||
            !interaction.member ||
            !(interaction.member instanceof GuildMember)
        )
            return false;
        if (!this.checkMemberRoles(interaction.member)) {
            await interaction.reply({
                content:
                    this.client.translate(interaction.guildId, [
                        'error',
                        'missingRole',
                    ]) + `\`${this.roles.join(', ')}\``,
                ephemeral: true,
            });
            return false;
        }
        if (!interaction.member.voice.channel) {
            await interaction.reply({
                content: this.client.translate(interaction.guildId, [
                    'error',
                    'voice',
                    'user',
                    'notConnected',
                ]),
                ephemeral: true,
            });
            return false;
        }
        if (!(interaction.member.voice.channel instanceof VoiceChannel)) {
            await interaction.reply({
                content: this.client.translate(interaction.guildId, [
                    'error',
                    'voice',
                    'invalid',
                ]),
                ephemeral: true,
            });
            return false;
        }
        if (!this.checkClientVoice(interaction.member.voice.channel)) {
            await interaction.reply({
                content: this.client.translate(interaction.guildId, [
                    'error',
                    'voice',
                    'client',
                    'noPermissions',
                ]),
                ephemeral: true,
            });
            return false;
        }
        if (!music) return true;
        // if music check if member in the same voice channel as client!
        return false;
    }
}
