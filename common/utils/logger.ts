export class Logger {
    private name: string;
    private level: Logger.Level;

    public constructor(name: string, level: Logger.Level) {
        this.name = name;
        this.level = level;
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

    private printFormated(level: Logger.Level, msg: string): void {
        let spaces = '  ';
        if ([Logger.Level.ERROR, Logger.Level.DEBUG].includes(level))
            spaces = ' ';

        console.log(`${Logger.Level[level]}${spaces}(${this.name}):  ${msg}`);
    }

    public static getLevel(lvl: string | undefined): Logger.Level {
        try {
            if (lvl === undefined) return Logger.Level.INFO;
            const s: string = lvl.toUpperCase();
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
