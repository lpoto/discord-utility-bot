import { english } from '.';
import { Language, LanguageKeyPath } from '../../../';

export class Translator {
    private textJson: Language;

    public constructor() {
        this.textJson = english;
    }

    public translate(keys: LanguageKeyPath, args?: string[]): string {
        try {
            let lang: any = this.textJson;
            for (let i = 0; i < keys.length; i++) lang = lang[keys[i]];
            let s: string = lang;
            if (args)
                for (let i = 0; i < args.length; i++)
                    s = s.replace(`{${i}}`, args[i]);
            return s;
        } catch (error) {
            console.error('Error during translation: ', error);
            return ' / ';
        }
    }

    public getFullLanguage(): Language {
        return this.textJson;
    }
}
