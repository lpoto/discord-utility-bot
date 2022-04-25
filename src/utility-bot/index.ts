import { Intents, Permissions } from 'discord.js';
import { Connection } from 'typeorm';
import { Logger } from '../utils';
import { UtilityClient } from './client';

export function getMusicEntitites(): any[] {
    return [];
}

export async function startUtilityClient(
    con: Connection,
    token: string,
    version: string,
    logger: Logger,
): Promise<void> {
    logger.info('Starting utility bot ' + version);
    if (!con.isConnected) {
        return;
    }
    return new UtilityClient({
        token: token,
        logger: logger,
        version: version,
        intents: [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.GUILD_VOICE_STATES,
            Intents.FLAGS.GUILD_MEMBERS,
            Intents.FLAGS.GUILD_PRESENCES,
        ],
        clientTextPermissions: [
            Permissions.FLAGS.SEND_MESSAGES,
            Permissions.FLAGS.READ_MESSAGE_HISTORY,
            Permissions.FLAGS.CREATE_PUBLIC_THREADS,
        ],
    }).run();
}
