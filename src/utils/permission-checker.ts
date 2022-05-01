import {
    ButtonInteraction,
    CommandInteraction,
    GuildMember,
    Message,
    PermissionResolvable,
    SelectMenuInteraction,
    TextBasedChannel,
    TextChannel,
    ThreadChannel,
    VoiceBasedChannel,
    VoiceChannel,
} from 'discord.js';
import { Notification } from '../common-entities';
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

    public checkClientText(
        channel: TextBasedChannel,
        interaction?:
            | ButtonInteraction
            | CommandInteraction
            | SelectMenuInteraction,
    ): boolean {
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
        const valid: boolean = this.clientTextPermissions.every((p) =>
            channel.permissionsFor(member).has(p),
        );
        if (!valid) {
            this.client.notify({
                warn: true,
                interaction: interaction,
                channelId: channel.id,
                content: this.client.translate(
                    ['common', 'errors', 'missingPermissions'],
                    this.clientTextPermissions.join(', '),
                ),
            });
        }
        return valid;
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

    public validateMemberVoiceFromThread(message: Message): boolean {
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
        const notification: Notification = Notification.create({
            clientId: this.client.user.id,
            userId: member.id,
            guildId: member.guild.id,
            name: '?',
            minutesToPersist: 1,
        });

        if (!member.voice.channel) {
            Notification.findOne({
                userId: member.id,
                guildId: member.guild.id,
                clientId: this.client.user.id,
                name: 'memberNoVoice',
            }).then((r) => {
                if (r) return;
                notification.name = 'memberNoVoice';
                notification.save().then(() => {
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
                });
            });
            return false;
        }

        if (!(member.voice.channel instanceof VoiceChannel)) {
            Notification.findOne({
                userId: member.id,
                guildId: member.guild.id,
                clientId: this.client.user.id,
                name: 'invalidVoice',
            }).then((r) => {
                if (r) return;
                notification.name = 'invalidVoice';
                notification.save().then(() => {
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
                });
            });
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
            return false;
        }

        if (
            member.guild.me?.voice.channel &&
            member.guild.me?.voice.channel !== member.voice.channel
        ) {
            Notification.findOne({
                userId: member.id,
                guildId: member.guild.id,
                clientId: this.client.user.id,
                name: 'memberDifferentChannel',
            }).then((r) => {
                if (r) return;
                notification.name = 'memberDifferentChannel';
                notification.save().then(() => {
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
                });
            });
            return false;
        }

        if (member.voice.deaf) {
            Notification.findOne({
                userId: member.id,
                guildId: member.guild.id,
                clientId: this.client.user.id,
                name: 'memberDeafened',
            }).then((r) => {
                if (r) return;
                notification.name = 'memberDeafened';
                notification.save().then(() => {
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
                });
            });
            return false;
        }

        return true;
    }
}
