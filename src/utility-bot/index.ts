import { Intents, Permissions } from 'discord.js';
import { Connection } from 'typeorm';
import { Logger } from '../utils';
import { UtilityClient } from './client';
import { GuildRole, RolesMessage } from './entities';
import { Poll } from './entities/poll';
import { PollResponse } from './entities/poll-response';

export function getUtilityEntities(): any[] {
    return [GuildRole, RolesMessage, Poll, PollResponse];
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
            Permissions.FLAGS.MANAGE_THREADS,
            Permissions.FLAGS.MANAGE_ROLES,
            Permissions.FLAGS.SEND_MESSAGES_IN_THREADS,
        ],
        clientVoicePermissions: [],
        requiredMemberRoles: [],
    }).run();
}
