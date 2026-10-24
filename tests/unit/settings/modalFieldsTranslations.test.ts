import { msg } from "@lingui/core/macro";
import type { Messages } from "@lingui/core";
import { translationResources } from "../../../src/i18n";
import { validateTranslationMessage } from "../../../src/i18n/catalogue";
import concepts from "../../../scripts/plugin-key-map.json";

// Preserve the original reviewed legacy scope, excluding concepts retired from the UI.
// Authorship/completeness for ALL current messages remains the strict i18n:check gate.
const ids = new Set(Object.values(concepts)
	.filter(entry => entry.context.startsWith("settings.modalFields.") && Object.hasOwn(translationResources.en, entry.id))
	.map(entry => entry.id));
const modalFieldsMessages = (messages: Messages) => Object.fromEntries(Object.entries(messages).filter(([id]) => ids.has(id)));
const source = modalFieldsMessages(translationResources.en);
// "ID:" is the conventional technical prefix in several languages, not fallback padding.
const allowSameAsSource = new Set([msg({ message: "ID: {id}", context: "settings.modalFields.manager.fieldId" }).id]);

describe("Reviewed modal fields settings messages in compiled catalogues", () => {
	it("has a nonempty active English scope", () => expect(ids.size).toBeGreaterThan(0));
	it.each(Object.entries(translationResources).filter(([name]) => name !== "en"))(
		"%s retains the reviewed messages and ICU argument contracts",
		(_name, locale) => {
			const translated = modalFieldsMessages(locale);
			expect(Object.keys(translated).sort()).toEqual(Object.keys(source).sort());
			for (const [id, text] of Object.entries(source)) {
				const value = translated[id];
				expect(Array.isArray(value)).toBe(true);
				expect(value).not.toEqual([]);
				expect(() => validateTranslationMessage(id, text, value)).not.toThrow();
				if (!allowSameAsSource.has(id)) expect(value).not.toEqual(text);
			}
		}
	);
});
