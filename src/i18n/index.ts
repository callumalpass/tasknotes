import { I18nService } from "./I18nService";
import type { I18nServiceOptions } from "./types";
import { TranslationResources } from "./types";
import { en } from "./resources/en";
import { fr } from "./resources/fr";
import { ru } from "./resources/ru";
import { zh } from "./resources/zh";
import { de } from "./resources/de";
import { es } from "./resources/es";
import { ja } from "./resources/ja";
import { pt } from "./resources/pt";

export const translationResources = {
	en,
	fr,
	ru,
	zh,
	de,
	es,
	ja,
	pt,
} satisfies TranslationResources;

export type TranslationKey = string;

export function createI18nService(options?: Partial<I18nServiceOptions>): I18nService {
	return new I18nService({
		resources: translationResources,
		defaultLocale: "en",
		fallbackLocale: "en",
		...options,
	});
}

export { I18nService };
