import {
    Client,
    ClientOptions,
    Interaction,
    Message,
    ThreadChannel,
    User,
} from 'discord.js';
import { Music } from './music';

export class MusicClient extends Client {
    private guildMusics: { [guildId: string]: Music } = {};
    private musicRoleName: string;

    constructor(options: ClientOptions, musicRoleName: string) {
        super(options);
        this.musicRoleName = musicRoleName;
    }

    public async handleThreadMessage(msg: Message): Promise<void> {
        if (!(msg.channel instanceof ThreadChannel)) return;
        console.log('Handle thread message:', msg);
    }

    public async handleInteractions(interaction: Interaction): Promise<void> {
        console.log('Handle interaction:', interaction);
    }

    private async checkUser(user: User, music: Music): Promise<boolean> {
        // check if user has the required role
        /* check if user is in the same channel as client,
        or client is not in channel*/
        if (!music.ready || !music.guild) return false;
        return music.guild.members.fetch(user.id).then((member) => {
            if (!member || !member.roles.cache.has(this.musicRoleName))
                return false;
            return true;
        });
    }
}
