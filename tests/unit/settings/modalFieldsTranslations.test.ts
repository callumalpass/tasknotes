import { en } from "../../../src/i18n/resources/en";
import { de } from "../../../src/i18n/resources/de";
import { es } from "../../../src/i18n/resources/es";
import { fr } from "../../../src/i18n/resources/fr";
import { ja } from "../../../src/i18n/resources/ja";
import { ko } from "../../../src/i18n/resources/ko";
import { pt } from "../../../src/i18n/resources/pt";
import { ru } from "../../../src/i18n/resources/ru";
import { zh } from "../../../src/i18n/resources/zh";

const locales = { de, es, fr, ja, ko, pt, ru, zh };
const placeholders = (text: string) => (text.match(/\{[^{}]+\}/g) ?? []).sort();

// "ID:" is the conventional prefix in these languages, matching the English source.
const allowSameAsSource = new Set(["manager.fieldId"]);

describe("Modal fields settings translations", () => {
	it.each(Object.entries(locales))(
		"%s translates every modal fields settings key and preserves interpolation",
		(_name, locale) => {
			const source = en.settings.modalFields;
			const translated = locale.settings.modalFields;
			expect(Object.keys(translated).sort()).toEqual(Object.keys(source).sort());
			for (const [section, texts] of Object.entries(source)) {
				if (typeof texts === "string") {
					const translation = (translated as Record<string, string>)[section];
					expect(translation.trim()).not.toBe("");
					expect(placeholders(translation)).toEqual(placeholders(texts));
					continue;
				}
				const translatedSection = translated[section as keyof typeof translated] as Record<
					string,
					string | Record<string, string>
				>;
				for (const [key, text] of Object.entries(texts)) {
					const value = translatedSection[key];
					if (typeof text === "string") {
						expect(typeof value).toBe("string");
						expect((value as string).trim()).not.toBe("");
						expect(placeholders(value as string)).toEqual(placeholders(text));
						if (!allowSameAsSource.has(`${section}.${key}`)) {
							expect(value).not.toBe(text);
						}
					} else {
						expect(Object.keys(value as Record<string, string>).sort()).toEqual(
							Object.keys(text).sort()
						);
						for (const [nestedKey, nestedText] of Object.entries(text)) {
							const nestedValue = (value as Record<string, string>)[nestedKey];
							expect(nestedValue.trim()).not.toBe("");
							expect(placeholders(nestedValue)).toEqual(placeholders(nestedText));
							if (!allowSameAsSource.has(`${section}.${key}`)) {
								expect(nestedValue).not.toBe(nestedText);
							}
						}
					}
				}
			}
		}
	);

	it("zh translates the modal fields settings chrome", () => {
		expect(zh.settings.modalFields.header).not.toBe(en.settings.modalFields.header);
		expect(zh.settings.modalFields.manager.enabled).toBe("已启用：");
	});
});
