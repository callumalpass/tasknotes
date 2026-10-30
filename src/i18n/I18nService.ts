import { Events } from "obsidian";
import { setupI18n, type MessageDescriptor, type Messages } from "@lingui/core";
import { bindUIDisplay, uiText } from "./runtime";
import type { I18nServiceOptions, InterpolationValues, LocaleChangeEvent, TranslationResources } from "./types";

function normalizeLocale(locale: string): string {
	return locale.toLowerCase().replace(/_/g, "-").split("-")[0];
}

/** The plugin-owned Lingui instance; downloads never gate construction. */
export class I18nService extends Events {
	readonly lingui = setupI18n();
	private readonly resources: TranslationResources;
	private readonly defaultLocale: string;
	private readonly fallbackLocale: string;
	private readonly getSystemLocaleFn?: () => string;
	private readonly availableLocales: string[];
	private currentLocale: string;

	constructor(options: I18nServiceOptions) {
		super();
		this.resources = { ...options.resources };
		this.availableLocales = options.availableLocales ?? Object.keys(options.resources);
		this.defaultLocale = options.defaultLocale;
		this.fallbackLocale = options.fallbackLocale ?? "en";
		this.getSystemLocaleFn = options.getSystemLocale;
		this.currentLocale = this.resolveLocale(options.initialLocale ?? this.defaultLocale);
		this.activate();
	}

	getAvailableLocales(): string[] {
		return [...new Set([...this.availableLocales, ...Object.keys(this.resources)])];
	}

	getPreferredLocale(locale: string): string {
		const preferred = locale === "system" ? this.getSystemLocale() : normalizeLocale(locale);
		return this.getAvailableLocales().includes(preferred) ? preferred : this.defaultLocale;
	}

	hasLocale(locale: string): boolean {
		return Object.prototype.hasOwnProperty.call(this.resources, normalizeLocale(locale));
	}

	registerLocale(locale: string, resources: Messages): void {
		const normalized = normalizeLocale(locale);
		if (normalized === this.defaultLocale) throw new Error("Cannot replace the bundled default language");
		this.resources[normalized] = resources;
		// Refresh this core immediately, without stealing another service's UI binding.
		if (normalized === this.currentLocale) this.activate(false);
	}

	/** Endonyms are intentional native-script data, not English UI copy. */
	getNativeLanguageName(languageCode: string): string {
		const nativeNames: Record<string, string> = {
			en: "English", fr: "Français", de: "Deutsch", es: "Español", it: "Italiano",
			pt: "Português (Brasil)", ru: "Русский", zh: "简体中文", ja: "日本語", ko: "한국어",
		};
		return nativeNames[languageCode] || languageCode;
	}

	getCurrentLocale(): string {
		return this.currentLocale;
	}

	setLocale(locale: string): void {
		const normalized = this.resolveLocale(locale);
		if (normalized === this.currentLocale) return;
		const previous = this.currentLocale;
		this.currentLocale = normalized;
		this.activate();
		const event: LocaleChangeEvent = { previous, current: normalized };
		this.trigger("locale-changed", event);
	}

	translate(descriptor: MessageDescriptor, params?: InterpolationValues): string {
		return uiText(descriptor, params, this.lingui);
	}

	getSystemLocale(): string {
		const preferences = this.getSystemLocaleFn
			? [this.getSystemLocaleFn()]
			: typeof navigator !== "undefined" ? [...(navigator.languages ?? []), navigator.language] : [];
		for (const preference of preferences) {
			if (!preference) continue;
			const locale = normalizeLocale(preference);
			if (this.getAvailableLocales().includes(locale)) return locale;
		}
		return this.defaultLocale;
	}

	private activate(bindDisplay = true): void {
		this.lingui.loadAndActivate({
			locale: this.currentLocale,
			locales: this.currentLocale === "pt" ? "pt-BR" : this.currentLocale === "zh" ? "zh-CN" : this.currentLocale,
			messages: { ...this.resources[this.defaultLocale], ...this.resources[this.fallbackLocale], ...this.resources[this.currentLocale] },
		});
		if (bindDisplay) bindUIDisplay(this.lingui);
	}

	private resolveLocale(locale: string): string {
		const preferred = this.getPreferredLocale(locale);
		return this.hasLocale(preferred) ? preferred : this.defaultLocale;
	}
}
