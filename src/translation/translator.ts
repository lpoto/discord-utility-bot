import { Languages } from '.';
import { Language, LanguageKeyPath, LanguageString } from '../../';
import { GuildLanguage } from '../entities';

export class Translator {
    private defaultLanguage: LanguageString;
    private languages: { [key in LanguageString]: Language };
    private guildLanguages: { [key: string]: LanguageString };

    public constructor(defaultLanguage: LanguageString) {
        this.defaultLanguage = defaultLanguage;
        this.guildLanguages = {};
        this.languages = Languages;
    }

    public setGuidLanguage(lang: LanguageString, guildId: string): void {
        this.guildLanguages[guildId] = lang;
        GuildLanguage.findOne({ where: { guildId: guildId } }).then((l) => {
            if (l) {
                l.language = lang;
                l.save();
            } else {
                const l2: GuildLanguage = GuildLanguage.create({
                    guildId: guildId,
                    language: lang,
                });
                l2.save();
            }
        });
    }

    public translate(
        guildId: string | null,
        keys: LanguageKeyPath,
        args?: string[],
    ): string {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let lang: any = this.getLanguage(guildId);
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

    public async setup(): Promise<void> {
        return GuildLanguage.find().then((languages) => {
            if (!languages) return;
            for (const l of languages) {
                if (!(l.language in this.languages)) {
                    l.language = this.defaultLanguage;
                    l.save();
                }
                this.guildLanguages[l.guildId] = l.language;
            }
        });
    }

    private getLanguage(guildId: string | null): Language {
        if (!guildId || !(guildId in this.guildLanguages))
            return this.languages[this.defaultLanguage];
        return this.languages[this.guildLanguages[guildId]];
    }
}
