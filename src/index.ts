import { Intents } from 'discord.js';
import { MusicClient } from './client';
import config from './config.json';
import { LanguageString } from './translation';

const client: MusicClient = new MusicClient(
    {
        intents: [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.GUILD_VOICE_STATES,
        ],
    },
    config.musicRole,
    LanguageString.EN,
);

MusicClient.run(client, config.token);
