import { Connection, createConnection } from 'typeorm';
import { bots } from '../package.json';
import { CustomClient, Logger } from './utils';
import { MusicClient } from './music-bot';
import { UtilityClient } from './utility-bot';
import { StartClientOptions } from '../';
import { MusicEntities } from './music-bot';
import { UtilityEntities } from './utility-bot';
import * as CommonEntities from './common-entities';
import { ErrorHandler } from './utils/error-handler';

function handleExceptions(logger: Logger): void {
    process.on('uncaughtException', (error: Error) => {
        const handler: ErrorHandler = new ErrorHandler(logger);
        handler.add(error);
        handler.log();
    });
    process.on('unhandledRejection', (error: Error) => {
        const handler: ErrorHandler = new ErrorHandler(logger);
        handler.add(error);
        handler.log();
    });
}

function getEntities(logger: Logger): any[] {
    let entities: any[] = Object.values(CommonEntities);
    for (const e of [MusicEntities, UtilityEntities]) {
        entities = entities.concat(Object.values(e));
    }
    logger.debug(`Found ${entities.length} entities`);
    return entities;
}

const mainLogger: Logger = new Logger(
    Logger.mainLogger,
    Logger.getLevel(process.env.LOG_LEVEL),
);
handleExceptions(mainLogger);

createConnection({
    type: 'postgres',
    port: Number(process.env.POSTGRES_PORT),
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    synchronize: true,
    entities: getEntities(mainLogger),
}).then((con: Connection) => {
    if (!con.isConnected)
        return mainLogger.error('Could not establish database connection.');
    const clients: [typeof CustomClient, StartClientOptions][] = [];
    for (const bot of [
        [MusicClient, bots.music.version, 'MUSIC_BOT'],
        [UtilityClient, bots.utility.version, 'UTILITY_BOT'],
    ]) {
        for (let i = 0; i <= 3; i++) {
            const botName = `${bot[2]}${i > 0 ? i.toString() : ''}`;
            const token: string | undefined = process.env[`${botName}_TOKEN`];
            if (!token) continue;
            mainLogger.debug(`Found '${botName}_TOKEN'`);
            if (clients.find((c) => c[1].token === token)) {
                mainLogger.debug(`'${botName}_TOKEN' is already used`);
                continue;
            }
            clients.push([
                bot[0] as typeof CustomClient,
                {
                    connection: con,
                    token: token,
                    version: bot[1] as string,
                    logLevel: Logger.getLevel(
                        process.env[`${botName}_LOG_LEVEL`],
                    ),
                },
            ]);
        }
    }
    mainLogger.info(`Starting ${clients.length} clients`);
    clients.forEach((c) => {
        c[0].start(c[1]).then((r) => {
            mainLogger.log(r[0], r[1]);
        });
    });
});
