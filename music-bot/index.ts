import { Intents, Permissions } from 'discord.js';
import { Connection } from 'typeorm';
import { MusicClient } from './client';
import { Queue, Song, QueueOption } from './entities';
import { Logger } from '../common/utils';

export function getMusicEntitites(): any[] {
    return [Queue, Song, QueueOption];
}

export async function startMusicClient(
    con: Connection,
    token: string,
    version: string,
    logger: Logger,
): Promise<void> {
    logger.info('Starting music bot ' + version);
    if (!con.isConnected) {
        return;
    }
    return new MusicClient({
        token: token,
        logger: logger,
        version: version,
        intents: [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.GUILD_VOICE_STATES,
        ],
        clientVoicePermissions: [
            Permissions.FLAGS.SPEAK,
            Permissions.FLAGS.CONNECT,
            Permissions.FLAGS.USE_VAD,
        ],
        clientTextPermissions: [
            Permissions.FLAGS.SEND_MESSAGES,
            Permissions.FLAGS.READ_MESSAGE_HISTORY,
            Permissions.FLAGS.CREATE_PUBLIC_THREADS,
        ],
        requiredMemberRoles: ['DJ'],
    }).run();
}
