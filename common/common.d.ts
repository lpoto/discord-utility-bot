import { english } from './translation';

export type Language = typeof english;

type Path<T> = PathTree<T>[keyof PathTree<T>];
type PathTree<T> = {
    [P in keyof T]-?: T[P] extends object ? [P] | [P, ...Path<T[P]>] : [P];
};
export type LanguageKeyPath = Path<Language>;
