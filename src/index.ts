import { Intents, Permissions } from 'discord.js';
import { createConnection } from 'typeorm';
import { MusicClient } from './client';
import { Queue, Song } from './entities';
import { LanguageString } from './translation';

createConnection({
    type: 'postgres',
    host: 'postgresdb',
    port: 5432,
    database: 'discord_music_bot',
    username: 'postgres',
    password: 'postgres',
    synchronize: true,
    entities: [Queue, Song],
}).then(() => {
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

    if (process.env.DISCORD_TOKEN)
        MusicClient.run(client, process.env.DISCORD_TOKEN);
    else console.log('Missing `DISCORD_TOKEN` env variable');
});
