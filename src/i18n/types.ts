import { EventRef } from "obsidian";
import type { MessageDescriptor, Messages } from "@lingui/core";




export type TranslationResources = Record<string, Messages>;

export type InterpolationValues = Record<string, string | number>;

export interface I18nServiceOptions {
	resources: TranslationResources;
	defaultLocale: string;
	fallbackLocale?: string;
	initialLocale?: string;
	getSystemLocale?: () => string;
	availableLocales?: string[];
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
	translate(descriptor: MessageDescriptor, params?: InterpolationValues): string;
	getSystemLocale(): string;
	on(
		event: "locale-changed",
		callback: (event: LocaleChangeEvent) => void,
		ctx?: unknown
	): EventRef;
}
