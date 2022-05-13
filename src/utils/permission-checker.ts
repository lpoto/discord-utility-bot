import {
    ButtonInteraction,
    CommandInteraction,
    GuildMember,
    Message,
    PartialMessage,
    PermissionResolvable,
    SelectMenuInteraction,
    TextBasedChannel,
    TextChannel,
    ThreadChannel,
    VoiceBasedChannel,
    VoiceChannel,
} from 'discord.js';
import { CustomClient } from '.';

export class PermissionChecker {
    private clientVoicePermissions: PermissionResolvable[];
    private clientTextPermissions: PermissionResolvable[];
    private client: CustomClient;

    public constructor(
        clientVoicePermissions: PermissionResolvable[],
        clientTextPermissions: PermissionResolvable[],
        client: CustomClient,
    ) {
        this.clientVoicePermissions = clientVoicePermissions;
        this.clientTextPermissions = clientTextPermissions;
        this.client = client;
    }

    public checkClientVoice(channel: VoiceBasedChannel): boolean {
        if (!channel.guild || !channel.guild.me) return true;
        const member: GuildMember = channel.guild.me;
        return this.clientVoicePermissions.every((p) =>
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
        const m: GuildMember = channel.guild.me;
        return this.clientTextPermissions.every((p) =>
            channel.permissionsFor(m).has(p),
        );
    }

    public validateMemberVoice(
        interaction:
            | CommandInteraction
            | ButtonInteraction
            | SelectMenuInteraction,
    ): boolean {
        if (
            !interaction.guild ||
            !interaction.guildId ||
            !interaction.guild.me ||
            !interaction.member ||
            !(interaction.member instanceof GuildMember)
        )
            return false;
        return this.validateMember(interaction.member, interaction);
    }

    public validateMemberVoiceFromThread(
        message: Message | PartialMessage,
    ): boolean {
        if (!message.guild || !message.member) return false;
        return this.validateMember(
            message.member,
            undefined,
            message.channelId,
        );
    }

    private validateMember(
        member: GuildMember,
        interaction?:
            | CommandInteraction
            | ButtonInteraction
            | SelectMenuInteraction,
        channelId?: string,
    ): boolean {
        if (!this.client.user || !member.guild.id) return false;

        this.client.logger.debug(
            `Validating member '${member.id}' permissions`,
            `in guild '${member.guild.id}'`,
        );

        if (!member.voice.channel) {
            this.client.notify({
                warn: true,
                content: this.client.translate([
                    'common',
                    'errors',
                    'voice',
                    'user',
                    'notConnected',
                ]),
                ephemeral: true,
                interaction: interaction,
                channelId: channelId,
            });
            this.client.logger.debug(
                `Member '${member.id}' is missing permissions`,
            );
            return false;
        }

        if (!(member.voice.channel instanceof VoiceChannel)) {
            this.client.notify({
                content: this.client.translate([
                    'common',
                    'errors',
                    'voice',
                    'invalid',
                ]),
                ephemeral: true,
                warn: true,
                interaction: interaction,
                channelId: channelId,
            });
            this.client.logger.debug(
                `Member '${member.id}' is missing permissions`,
            );
            return false;
        }

        if (!this.checkClientVoice(member.voice.channel)) {
            this.client.notify({
                content: this.client.translate([
                    'common',
                    'errors',
                    'voice',
                    'client',
                    'noPermissions',
                ]),
                ephemeral: true,
                warn: true,
                interaction: interaction,
                channelId: channelId,
            });
            this.client.logger.debug(
                `Member '${member.id}' is missing permissions`,
            );
            return false;
        }

        if (
            member.guild.me?.voice.channel &&
            member.guild.me?.voice.channel !== member.voice.channel
        ) {
            this.client.notify({
                content: this.client.translate([
                    'common',
                    'errors',
                    'voice',
                    'user',
                    'differentChannel',
                ]),
                ephemeral: true,
                interaction: interaction,
                warn: true,
                channelId: channelId,
            });
            this.client.logger.debug(
                `Member '${member.id}' is missing permissions`,
            );
            return false;
        }

        if (member.voice.deaf) {
            this.client.notify({
                content: this.client.translate([
                    'common',
                    'errors',
                    'voice',
                    'user',
                    'memberDeafened',
                ]),
                ephemeral: true,
                warn: true,
                channelId: channelId,
                interaction: interaction,
            });
            this.client.logger.debug(
                `Member '${member.id}' is missing permissions`,
            );
            return false;
        }
        this.client.logger.debug(
            `Member '${member.id}' has valid permissions`,
        );

        return true;
    }
}
