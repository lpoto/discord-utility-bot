import {
    GuildMember,
    Message,
    MessageAttachment,
    ThreadChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import fetch from 'node-fetch';
import { AbstractMusicEvent } from '../utils/abstract-music-event';
import * as Commands from '../commands';
import { Command } from '../music-bot';
import { PermissionChecker, RolesChecker } from '../../utils';

export class OnMessageCreate extends AbstractMusicEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(message: Message): Promise<void> {
        if (!this.client.ready || !(message.channel instanceof ThreadChannel))
            return;
        if (
            !message.guildId ||
            !(message.member instanceof GuildMember) ||
            !message.guild ||
            !message.guild.me ||
            message.member.id === message.guild.me.id ||
            !(message.channel instanceof ThreadChannel) ||
            message.channel.name !==
                this.client.translate(['music', 'thread', 'name']) ||
            !(message.content || message.attachments.size > 0) ||
            !this.client.user ||
            message.channel.ownerId !== this.client.user.id ||
            !this.client.permsChecker.checkClientText(message.channel)
        )
            return;
        Queue.findOne({
            clientId: this.client.user.id,
            messageId: message.channelId,
            threadId: message.channelId,
        })
            .then(async (queue) => {
                if (!queue || !(message.member instanceof GuildMember)) return;
                this.client.logger.debug(
                    `Thread message in guild '${message.guildId}'`,
                    ` in channel '${message.channelId}'`,
                );
                let joined = false;
                const rolesChecker: RolesChecker = this.client.rolesChecker;
                const permsChecker: PermissionChecker =
                    this.client.permsChecker;
                let cmd: Command | null | undefined = undefined;

                for (const val in Commands) {
                    const command: Command | null = this.getCommand(
                        val,
                        message.guildId,
                    );
                    if (
                        !command ||
                        !message.member ||
                        !command.reggex ||
                        !command.reggex.test(message.content)
                    )
                        continue;

                    cmd = command;
                    break;
                }

                if (cmd) {
                    try {
                        this.client.logger.debug(
                            'Exclamation mark command in thread',
                            `'${message.channelId}' in guild '${message.guildId}'`,
                        );

                        if (
                            !rolesChecker.checkMemberDefaultRoles({
                                member: message.member,
                                channelId: message.channelId,
                            }) ||
                            !permsChecker.validateMemberVoiceFromThread(
                                message,
                            )
                        )
                            return;

                        if (
                            !(await rolesChecker.checkMemberRolesForCommand({
                                member: message.member,
                                command: this.client.translate([
                                    'music',
                                    'exclamationCommand',
                                    'rolesConfigName',
                                ]),
                                channelId: message.channelId,
                                message: message,
                            }))
                        )
                            return;

                        if (!joined)
                            this.client.emitEvent('joinVoiceRequest', message);

                        setTimeout(
                            () => {
                                if (!cmd) return;
                                this.client.logger.debug(
                                    'Executing exclamation command ',
                                    `'${message.content.split(/(\s+)/)[0]}'`,
                                    `in guild '${message.guildId}'`,
                                );
                                cmd.executeFromReggex(message);
                            },
                            joined
                                ? cmd.interactionTimeout
                                : cmd.interactionTimeout + 200,
                        );
                        joined = true;
                        return;
                    } catch (e) {
                        if (e instanceof Error)
                            this.client.emitEvent('error', e);
                        return;
                    }
                }

                // get songs from message content and from all text file attachments
                // multiple songs may be added, each in its own line
                if (
                    !(await rolesChecker.checkMemberRolesForCommand({
                        member: message.member,
                        command: this.client.translate([
                            'music',
                            'commands',
                            'play',
                            'rolesConfigName',
                        ]),
                        channelId: message.channelId,
                        message: message,
                    }))
                )
                    return;

                let songs: string[] = [];
                if (message.content) songs = message.content.split('\n');

                if (message.attachments.size > 0) {
                    for (let i = 0; i < message.attachments.size; i++) {
                        const file: MessageAttachment | undefined =
                            message.attachments.at(i);
                        if (!file) continue;
                        const re = await fetch(file.url);
                        if (!re.ok) continue;
                        const text: string = await re.text();
                        if (text.length === 0) continue;

                        songs = songs.concat(text.split('\n'));
                    }
                }
                if (!joined)
                    this.client.emitEvent('joinVoiceRequest', message);
                setTimeout(
                    () => {
                        this.client.emitEvent('newSong', {
                            guildId: queue.guildId,
                            songNames: songs,
                            toFront: false,
                        });
                    },
                    joined ? 0 : 300,
                );
                joined = true;
            })
            .catch((e) => this.client.emitEvent('error', e));
    }

    private getCommand(val: string, guildId: string | null): Command | null {
        if (!guildId) return null;
        return new (<any>Commands)[val](this.client, guildId);
    }
}

export namespace OnMessageCreate {
    export type Type = [
        'messageCreate',
        ...Parameters<OnMessageCreate['callback']>,
    ];
}
