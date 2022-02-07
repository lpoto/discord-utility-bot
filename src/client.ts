import {
    Client,
    ClientOptions,
    Guild,
    Intents,
    Interaction,
    Message,
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

    public checkIfValidUser(user: User, guild: Guild): boolean {
        /* checks if user has musicRoleName
           check if user in same channel as client*/
        return true;
    }

    public addMusic(guildId: string) {
        if (!this.isReady() || this.checkIfPlaying(guildId)) return;
        // add new Music object
    }

    public checkIfPlaying(guildId: string): boolean {
        /* check if Music object exists in this.guildMusics
            and is a valid ready Music object */
        if (guildId in this.guildMusics) {
            if (
                !this.guildMusics[guildId].isReady ||
                this.guildMusics[guildId].SongCount === 0
            ) {
                delete this.guildMusics[guildId];
                return false;
            }
            return true;
        }
        return false;
    }

    public async onThreadMessage(msg: Message): Promise<void> {
        // TODO
    }

    public async onMusicSlashCommand(interaction: Interaction): Promise<void> {
        // TODO
    }
}
