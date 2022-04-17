import {
    GuildMember,
    Message,
    MessageAttachment,
    ThreadChannel,
} from 'discord.js';
import { MusicClient } from '../client';
import { Queue } from '../entities';
import { AbstractClientEvent } from '../utils/abstract-client-event';
import fetch from 'node-fetch';

export class OnMessageCreate extends AbstractClientEvent {
    public constructor(client: MusicClient) {
        super(client);
    }

    public async callback(message: Message): Promise<void> {
        if (!this.client.ready || !(message.channel instanceof ThreadChannel))
            return;
        if (
            message.guildId &&
            message.member instanceof GuildMember &&
            message.guild &&
            message.guild.me &&
            message.member.id !== message.guild.me.id &&
            message.channel instanceof ThreadChannel &&
            message.channel.name ===
                this.client.translate(message.guildId, [
                    'music',
                    'thread',
                    'name',
                ]) &&
            (message.content || message.attachments.size > 0) &&
            message.channel.ownerId === this.client.user?.id &&
            this.client.permsChecker.checkMemberRoles(message.member) &&
            this.client.permsChecker.validateMemberVoiceFromThread(message)
        ) {
            Queue.findOne({
                guildId: message.guildId,
                clientId: this.client.user.id,
            })
                .then(async (queue) => {
                    if (!queue) return;

                    if (
                        (message.guildId &&
                            !this.client.getVoiceConnection(
                                message.guildId,
                            )) ||
                        !message.guild?.me?.voice.channel
                    )
                        this.client.emitEvent('joinVoiceRequest', message);

                    // get songs from message content and from all text file attachments
                    // multiple songs may be added, each in its own line

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
                    this.client.emitEvent('newSong', {
                        guildId: queue.guildId,
                        songNames: songs,
                    });
                })
                .catch((e) => this.client.emitEvent('error', e));
        }
    }
}

export namespace OnMessageCreate {
    export type Type = [
        'messageCreate',
        ...Parameters<OnMessageCreate['callback']>
    ];
}
