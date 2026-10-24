import { I18nService } from "./I18nService";
import type { I18nServiceOptions } from "./types";
import { translationResources } from "./bundledResources";
import { languagePackConfig } from "./languagePackConfig";

export { translationResources };

export type { MessageDescriptor } from "@lingui/core";
export type { InterpolationValues } from "./types";

export function createI18nService(options?: Partial<I18nServiceOptions>): I18nService {
	return new I18nService({
		resources: translationResources,
		defaultLocale: "en",
		fallbackLocale: "en",
		availableLocales: languagePackConfig
			? Object.keys(languagePackConfig.manifest.packs)
			: undefined,
		...options,
	});
}

export { I18nService };
