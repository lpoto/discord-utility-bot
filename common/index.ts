import { Connection, createConnection } from 'typeorm';
import { getMusicEntitites, startMusicClient } from '../music-bot';
import { Notification } from './entities';
import { bots } from '../package.json';
import { Logger } from './utils';

createConnection({
    type: 'postgres',
    port: Number(process.env.POSTGRES_PORT),
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    synchronize: true,
    entities: [Notification].concat(getMusicEntitites()),
}).then((con: Connection) => {
    const logger: Logger = new Logger('Common', Logger.Level.INFO);
    const tokens: { [key: string]: string | undefined } = {
        music: process.env.MUSIC_BOT_TOKEN,
    };
    if (Object.values(tokens).every((t) => t === undefined))
        return logger.error('No discord tokens provided');
    if (!con.isConnected)
        return logger.error('Could not establish database connection.');
    if (tokens.music !== undefined) {
        startMusicClient(
            con,
            tokens.music,
            bots.music.version,
            new Logger(
                'MusicBot',
                Logger.getLevel(process.env.MUSIC_BOT_LOG_LEVEL),
            ),
        ).catch((e) => {
            logger.error(e);
        });
    }
});
