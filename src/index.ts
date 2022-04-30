import { Connection, createConnection } from 'typeorm';
import { bots } from '../package.json';
import { CustomClient, handleErrors, Logger } from './utils';
import { MusicClient } from './music-bot';
import { UtilityClient } from './utility-bot';
import { StartClientOptions } from '../';
import { MusicEntities } from './music-bot';
import { UtilityEntities } from './utility-bot';
import * as CommonEntities from './common-entities';

process.on('uncaughtException', (error: Error) => {
    handleErrors(error);
});
process.on('unhandledRejection', (error: Error) => {
    handleErrors(error);
});

function getEntities(): any[] {
    let entities: any[] = Object.values(CommonEntities);
    for (const e of [MusicEntities, UtilityEntities])
        entities = entities.concat(Object.values(e));
    return entities;
}

createConnection({
    type: 'postgres',
    port: Number(process.env.POSTGRES_PORT),
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    synchronize: true,
    entities: getEntities(),
}).then((con: Connection) => {
    const logger: Logger = new Logger();
    if (!con.isConnected)
        return logger.error('Could not establish database connection.');

    const clients: [typeof CustomClient, StartClientOptions][] = [
        [
            MusicClient,
            {
                connection: con,
                token: process.env.MUSIC_BOT_TOKEN,
                version: bots.music.version,
                logLevel: Logger.getLevel(process.env.MUSIC_BOT_LOG_LEVEL),
            },
        ],
        [
            UtilityClient,
            {
                connection: con,
                token: process.env.UTILITY_BOT_TOKEN,
                version: bots.utility.version,
                logLevel: Logger.getLevel(process.env.UTILITY_BOT_LOG_LEVEL),
            },
        ],
    ];
    clients.forEach((c) => {
        c[0].start(c[1]).then((r) => {
            logger.log(r[0], r[1]);
        });
    });
});
