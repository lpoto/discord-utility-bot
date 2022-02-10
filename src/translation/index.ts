import en from './en.json';
import slo from './en.json';

export enum LanguageString {
    EN = 'en',
    SLO = 'slo',
}
export type Language = typeof en | typeof slo;

type Path<T> = PathTree<T>[keyof PathTree<T>];
type PathTree<T> = {
    [P in keyof T]-?: T[P] extends object ? [P] | [P, ...Path<T[P]>] : [P];
};
export type LanguageKeyPath = Path<Language>;

export class Translator {
    private defaultLanguage: LanguageString;
    private languages: { [key in LanguageString]: Language };
    private guildLanguages: { [key: string]: LanguageString };

    constructor(defaultLanguage: LanguageString) {
        this.defaultLanguage = defaultLanguage;
        this.guildLanguages = {};
        this.languages = { en: en, slo: slo };
    }

    public setGuidLanguage(lang: LanguageString, guildId: string): void {
        this.guildLanguages[guildId] = lang;
    }

    public translate(guildId: string | null, keys: LanguageKeyPath): string {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let lang: any = this.getLanguage(guildId);
            for (let i = 0; i < keys.length; i++) lang = lang[keys[i]];
            return lang;
        } catch (error) {
            console.error('Error during translation: ', error);
            return ' / ';
        }
    }

    private getLanguage(guildId: string | null): Language {
        if (!guildId || !(guildId in this.guildLanguages))
            return this.languages[this.defaultLanguage];
        return this.languages[this.guildLanguages[guildId]];
    }
}
