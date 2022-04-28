import {
    ButtonInteraction,
    CommandInteraction,
    GuildMember,
    Message,
    PermissionResolvable,
    Role,
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
    private requiredMemberRoles: string[];
    private client: CustomClient;

    public constructor(
        clientVoicePermissions: PermissionResolvable[],
        clientTextPermissions: PermissionResolvable[],
        requiredMemberRoles: string[],
        client: CustomClient,
    ) {
        this.clientVoicePermissions = clientVoicePermissions;
        this.clientTextPermissions = clientTextPermissions;
        this.requiredMemberRoles = requiredMemberRoles;
        this.client = client;
    }

    public get roles(): string[] {
        return this.requiredMemberRoles;
    }

    public checkMemberRoles(member: GuildMember): boolean {
        return (
            member.roles.cache.find((r: Role) =>
                this.requiredMemberRoles.includes(r.name),
            ) !== undefined
        );
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
        const member: GuildMember = channel.guild.me;
        return this.clientTextPermissions.every((p) =>
            channel.permissionsFor(member).has(p),
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

    public validateMemberVoiceFromThread(message: Message): boolean {
        if (!message.guild || !message.member) return false;
        return this.validateMember(message.member);
    }

    private validateMember(
        member: GuildMember,
        interaction?:
            | CommandInteraction
            | ButtonInteraction
            | SelectMenuInteraction,
    ): boolean {
        if (!this.client.user || !member.guild.id) return false;
        const notification: Notification = Notification.create({
            clientId: this.client.user.id,
            userId: member.id,
            guildId: member.guild.id,
            name: '?',
            minutesToPersist: 10,
        });

        if (!member.voice.channel) {
            Notification.findOne({
                userId: member.id,
                guildId: member.guild.id,
                clientId: this.client.user.id,
                name: 'memberNoVoice',
            }).then((r) => {
                if (r) return;
                if (interaction) {
                    notification.name = 'memberNoVoice';
                    notification.save().then(() => {
                        interaction.reply({
                            content: this.client.translate([
                                'music',
                                'error',
                                'voice',
                                'user',
                                'notConnected',
                            ]),
                            ephemeral: true,
                        });
                    });
                }
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
                if (interaction) {
                    notification.name = 'invalidVoice';
                    notification.save().then(() => {
                        interaction.reply({
                            content: this.client.translate([
                                'music',
                                'error',
                                'voice',
                                'invalid',
                            ]),
                            ephemeral: true,
                        });
                    });
                }
            });
            return false;
        }

        if (!this.checkClientVoice(member.voice.channel)) {
            if (interaction) {
                interaction.reply({
                    content: this.client.translate([
                        'music',
                        'error',
                        'voice',
                        'client',
                        'noPermissions',
                    ]),
                    ephemeral: true,
                });
            }
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
                if (interaction) {
                    notification.name = 'memberDifferentChannel';
                    notification.save().then(() => {
                        interaction.reply({
                            content: this.client.translate([
                                'music',
                                'error',
                                'voice',
                                'user',
                                'differentChannel',
                            ]),
                            ephemeral: true,
                        });
                    });
                }
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
                if (interaction) {
                    notification.name = 'memberDeafened';
                    notification.save().then(() => {
                        interaction.reply({
                            content: this.client.translate([
                                'music',
                                'error',
                                'voice',
                                'user',
                                'memberDeafened',
                            ]),
                            ephemeral: true,
                        });
                    });
                }
            });
            return false;
        }

        return true;
    }
}
