import { Intents, Permissions } from 'discord.js';
import { createConnection } from 'typeorm';
import { MusicClient } from './client';
import {
    Queue,
    Song,
    GuildLanguage,
    Notification,
    QueueOption,
} from './entities';

createConnection({
    type: 'postgres',
    port: Number(process.env.POSTGRES_PORT),
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    synchronize: true,
    entities: [Queue, Song, QueueOption, Notification, GuildLanguage],
}).then(() => {
    const client: MusicClient = new MusicClient({
        intents: [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.GUILD_VOICE_STATES,
        ],
        defaultLanguage: 'en',
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
