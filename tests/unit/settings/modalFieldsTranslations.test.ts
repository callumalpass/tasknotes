import { translationResources } from "../../../src/i18n";
import { flattenTranslationTree } from "../../../src/i18n/I18nService";
import type { TranslationTree } from "../../../src/i18n/types";

function modalFieldsStrings(tree: TranslationTree): Record<string, string> {
	return Object.fromEntries(
		Object.entries(flattenTranslationTree(tree)).filter(([key]) =>
			key.startsWith("settings.modalFields.")
		)
	);
}

const source = modalFieldsStrings(translationResources.en);
const placeholders = (text: string) => (text.match(/\{[^{}]+\}/g) ?? []).sort();
// "ID:" is also the conventional prefix in several other languages.
const allowSameAsSource = new Set(["settings.modalFields.manager.fieldId"]);

describe("Modal fields settings translations", () => {
	it.each(Object.entries(translationResources).filter(([name]) => name !== "en"))(
		"%s translates every modal fields settings key and preserves interpolation",
		(_name, locale) => {
			const translated = modalFieldsStrings(locale);
			expect(Object.keys(translated).sort()).toEqual(Object.keys(source).sort());
			for (const [key, text] of Object.entries(source)) {
				const value = translated[key];
				expect(value.trim()).not.toBe("");
				expect(placeholders(value)).toEqual(placeholders(text));
				if (!allowSameAsSource.has(key)) {
					expect(value).not.toBe(text);
				}
			}
		}
	);
});
