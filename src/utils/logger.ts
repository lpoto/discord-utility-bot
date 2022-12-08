export class Logger {
    private name: string;
    private level: Logger.Level;

    public static mainLogger = 'MAIN';

    public constructor(name?: string, level?: Logger.Level) {
        if (name === undefined) this.name = Logger.mainLogger;
        else this.name = name;
        if (level === undefined) this.level = Logger.Level.INFO;
        else this.level = level;
        let n = 'LOG_LEVEL';
        if (this.name !== Logger.mainLogger) {
            n = name + '_' + n;
        }
        this.debug(`${n} = ${Logger.Level[this.level]}`);
        this.mainLog(
            Logger.Level.INFO,
            `Initialized logger '${this.name.toLowerCase()}'`,
        );
    }

    public info(msg: string, ...args: string[]): void {
        if (
            this.level !== Logger.Level.DEBUG &&
            this.level !== Logger.Level.INFO
        )
            return;
        return this.log(Logger.Level.INFO, msg, ...args);
    }

    public error(msg: string, ...args: string[]): void {
        return this.log(Logger.Level.ERROR, msg, ...args);
    }

    public warn(msg: string, ...args: string[]): void {
        if (
            this.level !== Logger.Level.DEBUG &&
            this.level !== Logger.Level.INFO &&
            this.level !== Logger.Level.WARN
        )
            return;
        return this.log(Logger.Level.WARN, msg, ...args);
    }

    public debug(msg: string, ...args: string[]): void {
        if (this.level !== Logger.Level.DEBUG) return;
        return this.log(Logger.Level.DEBUG, msg, ...args);
    }

    public log(level: Logger.Level, msg: string, ...args: string[]) {
        for (const s of args) msg += ' ' + s;
        this.printFormated(level, msg);
    }

    private mainLog(level: Logger.Level, msg: string, ...args: string[]) {
        for (const s of args) msg += ' ' + s;
        this.printFormated(level, msg, true);
    }

    private printFormated(
        level: Logger.Level,
        msg: string,
        main?: boolean,
    ): void {
        let name: string = main ? Logger.mainLogger : this.name;
        if (name.length > 13) name = name.substring(0, 13);
        let spaces = '  ';
        if ([Logger.Level.ERROR, Logger.Level.DEBUG].includes(level))
            spaces = ' ';
        const x: number =
            19 - (Logger.Level[level].length + spaces.length + name.length);
        const date: string = new Date(Date.now()).toLocaleString();
        let s: string = '';
        s += `${Logger.Level[level]}${spaces} ${name.toLowerCase()}:`;
        if (x >= 1) s += ' '.repeat(x);

        console.log(`${s}${msg}`);
    }

    public static getLevel(lvl: string | undefined): Logger.Level {
        try {
            if (lvl === undefined) return Logger.Level.INFO;
            const s: string = lvl.trim().toUpperCase();
            return Logger.Level[s as keyof typeof Logger.Level];
        } catch (e) {
            return Logger.Level.INFO;
        }
    }
}

export namespace Logger {
    export enum Level {
        DEBUG,
        INFO,
        ERROR,
        WARN,
    }
}
