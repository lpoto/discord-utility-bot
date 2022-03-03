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
import moment from 'moment';
import { Notification } from '../entities/notification';
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
        interaction?: CommandInteraction | ButtonInteraction,
    ): boolean {
        if (!this.client.user || !member.guild.id) return false;
        const notification: Notification = Notification.create({
            clientId: this.client.user.id,
            userId: member.id,
            guildId: member.guild.id,
            name: '?',
            expires: moment(moment.now()).add(1, 'h').toDate(),
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
                            content: this.client.translate(
                                interaction.guildId,
                                ['error', 'voice', 'user', 'notConnected'],
                            ),
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
                            content: this.client.translate(
                                interaction.guildId,
                                ['error', 'voice', 'invalid'],
                            ),
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
                    content: this.client.translate(interaction.guildId, [
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
                            content: this.client.translate(
                                interaction.guildId,
                                ['error', 'voice', 'user', 'differentChannel'],
                            ),
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
