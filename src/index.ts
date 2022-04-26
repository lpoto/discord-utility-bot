import { Connection, createConnection } from 'typeorm';
import { getMusicEntitites, startMusicClient } from './music-bot';
import { Notification } from './common-entities';
import { bots } from '../package.json';
import { handleErrors, Logger } from './utils';
import { getUtilityEntities, startUtilityClient } from './utility-bot';

createConnection({
    type: 'postgres',
    port: Number(process.env.POSTGRES_PORT),
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    synchronize: true,
    entities: [Notification]
        .concat(getMusicEntitites())
        .concat(getUtilityEntities()),
}).then((con: Connection) => {
    const logger: Logger = new Logger();
    const tokens: { [key: string]: string | undefined } = {
        music: process.env.MUSIC_BOT_TOKEN,
        utility: process.env.UTILITY_BOT_TOKEN,
    };
    if (Object.values(tokens).every((t) => t === undefined))
        return logger.error('No discord tokens provided');
    if (!con.isConnected)
        return logger.error('Could not establish database connection.');

    process.on('uncaughtException', (error: Error) => {
        handleErrors(error);
    });
    process.on('unhandledRejection', (error: Error) => {
        handleErrors(error);
    });

    if (tokens.music !== undefined)
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
    else logger.debug('No music bot token found');
    if (tokens.utility)
        startUtilityClient(
            con,
            tokens.utility,
            bots.utility.version,
            new Logger(
                'UtilityBot',
                Logger.getLevel(process.env.UTILITY_BOT_LOG_LEVEL),
            ),
        ).catch((e) => {
            logger.error(e);
        });
    else logger.debug('No utility bot token found');
});
