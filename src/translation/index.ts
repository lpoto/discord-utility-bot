import en from './en.json';

export { Translator } from './translator';

export const LANGUAGES: { [key in LanguageString]: Language } = {
    en: en,
};
export enum LanguageString {
    EN = 'en',
}
export type Language = typeof en;

type Path<T> = PathTree<T>[keyof PathTree<T>];
type PathTree<T> = {
    [P in keyof T]-?: T[P] extends object ? [P] | [P, ...Path<T[P]>] : [P];
};
export type LanguageKeyPath = Path<Language>;
