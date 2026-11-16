import { createI18nService } from "../../../src/i18n";
import type { TranslationResources } from "../../../src/i18n/types";

describe("bundled catalogue loading", () => {
	it("reads only the default and active catalogues when the service starts", () => {
		// Production catalogues decode on first read; reading every locale at
		// startup costs tens of milliseconds of plugin load time.
		const read: string[] = [];
		const resources: TranslationResources = {};
		for (const locale of ["en", "fr", "de", "ja"]) {
			Object.defineProperty(resources, locale, {
				enumerable: true,
				get() {
					read.push(locale);
					return { greeting: [`${locale} greeting`] };
				},
			});
		}

		const service = createI18nService({ resources, initialLocale: "fr" });

		expect(service.getAvailableLocales()).toEqual(["en", "fr", "de", "ja"]);
		expect(new Set(read)).toEqual(new Set(["en", "fr"]));
	});
});
