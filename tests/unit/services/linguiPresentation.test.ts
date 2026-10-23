import { msg } from "@lingui/core/macro";
import { deflateSync } from "node:zlib";
import { createI18nService, translationResources } from "../../../src/i18n";
import { unpackBundledCatalogue } from "../../../src/i18n/compressedCatalogue";
import { basesMessage } from "../../../src/i18n/basesMessages";
import { uiRichText } from "../../../src/i18n/richText";
import { messageForKey } from "../../../src/i18n/messages";

describe("Lingui plugin presentation adapters", () => {
	it.each(Object.keys(translationResources))("synchronously round-trips the actual %s catalogue without changing compiled ICU", locale => {
		const messages = translationResources[locale];
		const compressed = deflateSync(Buffer.from(JSON.stringify(messages))).toString("base64");
		expect(unpackBundledCatalogue(compressed).messages).toEqual(messages);
	});

	it.each(Object.keys(translationResources))("serializes native Bases plural/count output consistently with Lingui in %s", locale => {
		const service = createI18nService({ initialLocale: locale });
		const descriptor = msg({ message: "{days, plural, one {# day} other {# days}}", context: "generated Bases due countdown" });
		const expression = basesMessage(descriptor, { days: "days" });
		// Generated expressions contain only quoted catalogue strings and trusted
		// test-supplied numeric identifiers. This is a test evaluator, not app eval.
		const evaluate = new Function("days", "choose", `return ${expression.replaceAll("if(", "choose(")}`);
		const choose = (condition: boolean, yes: string, no: string) => condition ? yes : no;
		for (const days of [0, 1, 2, 5, 11, 21, 1000, 1000000]) {
			expect(evaluate(days, choose)).toBe(service.translate(descriptor, { days }));
		}
	});

	it("escapes translated Bases literals, not the caller's native expressions", () => {
		createI18nService();
		const descriptor = msg({ message: "{minutes, number}m", context: "generated Bases compact minutes" });
		const expression = basesMessage(descriptor, { minutes: "formula.focusMinutes" });
		expect(expression).toContain("formula.focusMinutes");
		expect(() => basesMessage(descriptor, {})).toThrow("Missing Bases message expression");
	});

	it("renders only explicitly mapped numeric tags and keeps interpolation values as text", () => {
		createI18nService();
		const parent = document.createElement("div");
		uiRichText(parent, messageForKey("settings.integrations.webhooks.modals.add.transformHelp.jsonFiles"),
			{ example: '<0>user value</0><img src=x onerror="alert(1)">' }, { "0": "strong", "1": "code" });
		expect(parent.querySelectorAll("strong")).toHaveLength(1);
		expect(parent.querySelectorAll("code")).toHaveLength(1);
		expect(parent.querySelector("img")).toBeNull();
		expect(parent.querySelector("code")?.textContent).toBe('<0>user value</0><img src=x onerror="alert(1)">');
	});
});
