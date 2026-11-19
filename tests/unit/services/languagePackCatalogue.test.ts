import { compileMessageOrThrow } from "@lingui/message-utils/compileMessage";
import { compiledMessages, isCompiledMessages, validateTranslationMessage } from "../../../src/i18n/catalogue";
import { compiledCatalogue } from "../../helpers/compiled-catalogue.mjs";
const compile = (text: string): unknown => JSON.parse(JSON.stringify(compileMessageOrThrow(text)));

describe("compiled language-pack catalogue validation", () => {
	it("accepts compiled JSON and rejects obsolete trees, raw strings and executable values", () => {
		const catalogue = compiledCatalogue({ greeting: "Hello {name}" });
		expect(compiledMessages(catalogue)).toEqual(catalogue);
		for (const invalid of [{}, { common: { save: "Save" } }, { greeting: "Hello" }, { greeting: () => "Hello" }]) {
			expect(isCompiledMessages(invalid)).toBe(false);
			expect(() => compiledMessages(invalid)).toThrow("Invalid compiled language catalogue");
		}
	});
	it("permits reordered and repeated meaningful arguments", () => {
		expect(() => validateTranslationMessage("greeting", compile("Hello {first} {last}"), compile("{last}, {first} ({first})"))).not.toThrow();
	});
	it("rejects omitted arguments and invented names", () => {
		expect(() => validateTranslationMessage("greeting", compile("Hello {name}"), compile("Bonjour"))).toThrow();
		expect(() => validateTranslationMessage("greeting", compile("Hello {name}"), compile("Bonjour {nom}"))).toThrow();
	});
	it("accepts locale-specific plural categories without an English suffix exception", () => {
		const source = compile("{minutes, plural, one {{minutes, number} minute ago} other {{minutes, number} minutes ago}}");
		const target = compile("{minutes, plural, other {{minutes, number}分前}}");
		expect(() => validateTranslationMessage("relative", source, target)).not.toThrow();
		expect(() => validateTranslationMessage("relative", source, compile("数分前"))).toThrow();
		expect(() => validateTranslationMessage("relative", compile("{minutes} minute{plural} ago"), compile("{minutes}分前"))).toThrow();
	});
	it("preserves number and plural/ordinal argument roles", () => {
		expect(() => validateTranslationMessage("count", compile("{count, number}"), compile("{count}"))).toThrow();
		expect(() => validateTranslationMessage("count", compile("{count, plural, other {#}}"), compile("{count, selectordinal, other {#}}"))).toThrow();
	});
	it("rejects unbounded selector nesting, missing other arms and invalid offsets", () => {
		let nested: unknown = ["text"];
		for (let depth = 0; depth < 20; depth++) nested = [["count", "plural", { other: nested }]];
		expect(isCompiledMessages({ deep: nested })).toBe(false);
		expect(isCompiledMessages({ missing: [["count", "plural", { one: ["one"] }]] })).toBe(false);
		expect(isCompiledMessages({ invalid: [["count", "plural", { offset: -1, other: ["other"] }]] })).toBe(false);
	});
	it("treats explicitly quoted double-brace template examples as literal data", () => {
		expect(() => validateTranslationMessage("description", compile("Folder supports '{{year}}' and '{{month}}'"), compile("Папка для архивирования"))).not.toThrow();
		expect(() => validateTranslationMessage("description", compile("Folder supports '{{year}}' for {name}"), compile("Dossier pour {name}"))).not.toThrow();
	});
});
