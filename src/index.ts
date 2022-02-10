import { Intents, Permissions } from 'discord.js';
import { MusicClient } from './client';
import config from './config.json';
import { LanguageString } from './translation';

const client: MusicClient = new MusicClient({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_VOICE_STATES,
    ],
    defaultLanguage: LanguageString.EN,
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
});

MusicClient.run(client, config.token);
