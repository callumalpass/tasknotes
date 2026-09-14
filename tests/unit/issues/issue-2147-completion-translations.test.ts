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

describe("Issue #2147: completion-date translations", () => {
	it.each(Object.entries(locales))("%s translates every completion action and preserves interpolation", (_name, locale) => {
		const groups = [
			[en.contextMenus.task.completion, locale.contextMenus.task.completion],
			[en.settings.appearance.taskCards.completionSubmenu, locale.settings.appearance.taskCards.completionSubmenu],
		];
		for (const [source, translated] of groups) {
			expect(Object.keys(translated).sort()).toEqual(Object.keys(source).sort());
			for (const [key, text] of Object.entries(source)) {
				const translation = (translated as Record<string, string>)[key];
				expect(translation.trim()).not.toBe("");
				expect(translation).not.toBe(text);
				expect(placeholders(translation)).toEqual(placeholders(text));
			}
		}
	});
});
