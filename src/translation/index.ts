import en from './en.json';
import slo from './en.json';

export { Translator } from './translator';

export const LANGUAGES: { [key in LanguageString]: Language } = {
    en: en,
    slo: slo,
};
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
