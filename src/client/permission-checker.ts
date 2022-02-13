import {
    ButtonInteraction,
    CommandInteraction,
    GuildMember,
    Message,
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

    public validateMemberVoice(
        interaction: CommandInteraction | ButtonInteraction,
        music: Music | null = null,
    ): boolean {
        if (
            !interaction.guild ||
            !interaction.guildId ||
            !interaction.guild.me ||
            !interaction.member ||
            !(interaction.member instanceof GuildMember)
        )
            return false;
        return this.validateMember(interaction.member, music, interaction);
    }

    public validateMemberVoiceFromThread(
        message: Message,
        music: Music | null = null,
    ): boolean {
        if (!message.guild || !message.member) return false;
        return this.validateMember(message.member, music);
    }

    private validateMember(
        member: GuildMember,
        music: Music | null,
        interaction?: CommandInteraction | ButtonInteraction,
    ): boolean {
        if (!member.voice.channel) {
            if (interaction)
                interaction.reply({
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
        if (!(member.voice.channel instanceof VoiceChannel)) {
            if (interaction)
                interaction.reply({
                    content: this.client.translate(interaction.guildId, [
                        'error',
                        'voice',
                        'invalid',
                    ]),
                    ephemeral: true,
                });
            return false;
        }
        if (!this.checkClientVoice(member.voice.channel)) {
            if (interaction)
                interaction.reply({
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
        if (member.guild.me?.voice.channel !== member.voice.channel) {
            if (interaction)
                interaction.reply({
                    content: this.client.translate(interaction.guildId, [
                        'error',
                        'voice',
                        'user',
                        'differentChannel',
                    ]),
                    ephemeral: true,
                });
            return false;
        }
        return true;
    }
}
