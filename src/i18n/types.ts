import { EventRef, Events } from 'obsidian';

export type TranslationValue = string | TranslationTree;

export interface TranslationTree {
    [key: string]: TranslationValue;
}

export type TranslationResources = Record<string, TranslationTree>;

export type InterpolationValues = Record<string, string | number>;

export interface I18nServiceOptions {
    resources: TranslationResources;
    defaultLocale: string;
    fallbackLocale?: string;
    initialLocale?: string;
    getSystemLocale?: () => string;
}

export interface LocaleChangeEvent {
    previous: string;
    current: string;
}

export interface II18nService {
    getCurrentLocale(): string;
    setLocale(locale: string): void;
    getAvailableLocales(): string[];
    getNativeLanguageName(languageCode: string): string;
    translate(key: string, params?: InterpolationValues): string;
    translatePlural(baseKey: string, count: number, params?: InterpolationValues): string;
    resolveKey(key: string): string | undefined;
    getSystemLocale(): string;
    on(event: 'locale-changed', callback: (event: LocaleChangeEvent) => void, ctx?: any): EventRef;
}

export type LeafPaths<T, Prefix extends string = ''> =
    T extends string
        ? (Prefix extends '' ? never : Prefix)
        : T extends Record<string, any>
            ? {
                [K in keyof T & string]: LeafPaths<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>
            }[keyof T & string]
            : never;

export type TranslationSchema = TranslationTree;
