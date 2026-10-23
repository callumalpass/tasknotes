import { msg } from "@lingui/core/macro";
import { flattenTranslations, validateTranslationMessage } from "../../../src/i18n/catalogue";

describe("language-pack catalogue validation", () => {
	it("flattens nested resources into a prototype-free dictionary", () => {
		const messages = flattenTranslations({ common: { save: "Save" } });
		expect(messages[msg({ message: "Save", context: "common.save" })]).toBe("Save");
		expect(Object.getPrototypeOf(messages)).toBeNull();
	});

	it("permits reordered and repeated placeholders", () => {
		expect(() =>
			validateTranslationMessage(
				"greeting",
				"Hello {first} {last}",
				"{last}, {first} ({first})"
			)
		).not.toThrow();
	});

	it("rejects omitted meaningful placeholders and invented names", () => {
		expect(() => validateTranslationMessage("greeting", "Hello {name}", "Bonjour")).toThrow();
		expect(() =>
			validateTranslationMessage("greeting", "Hello {name}", "Bonjour {nom}")
		).toThrow();
	});

	it("allows omission of legacy English grammatical suffixes only on known messages", () => {
		expect(() =>
			validateTranslationMessage(
				msg({ message: "{minutes, plural, one {{minutes} minute ago} other {{minutes} minutes ago}}", context: "settings.integrations.timeFormats.minutesAgo" }),
				"{minutes} minute{plural} ago",
				"{minutes}分前"
			)
		).not.toThrow();
		expect(() =>
			validateTranslationMessage("unrelated", "{minutes} minute{plural} ago", "{minutes}分前")
		).toThrow();
		expect(() =>
			validateTranslationMessage(
				msg({ message: "{minutes, plural, one {{minutes} minute ago} other {{minutes} minutes ago}}", context: "settings.integrations.timeFormats.minutesAgo" }),
				"{minutes} minute{plural} ago",
				"数分前"
			)
		).toThrow();
	});

	it("does not mistake documented double-brace template examples for interface parameters", () => {
		expect(() =>
			validateTranslationMessage(
				"description",
				"Folder supports {{year}} and {{month}}",
				"Папка для архивирования"
			)
		).not.toThrow();
		expect(() =>
			validateTranslationMessage(
				"description",
				"Folder supports {{year}} for {name}",
				"Dossier pour {name}"
			)
		).not.toThrow();
	});
});
