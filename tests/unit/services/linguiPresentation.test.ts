import { msg } from "@lingui/core/macro";
import { deflateSync } from "node:zlib";
import { createI18nService, translationResources } from "../../../src/i18n";
import { unpackBundledCatalogue } from "../../../src/i18n/compressedCatalogue";
import { basesMessage } from "../../../src/i18n/basesMessages";
import { uiRichText } from "../../../src/i18n/richText";
import { recurrenceDisplayText, recurrenceYearlyOn } from "../../../src/i18n/recurrence";
import { oauthCallbackHtml } from "../../../src/i18n/oauthCallbackHtml";
import { displayError } from "../../../src/i18n/runtime";

describe("Lingui plugin presentation adapters", () => {
	it("escapes callback titles, descriptions and language attributes without accepting translator HTML", () => {
		const title = '</title><script>alert(1)</script>';
		const body = '<img src=x onerror="alert(1)"> & text';
		const doc = new DOMParser().parseFromString(oauthCallbackHtml(title, body, 'en" onload="alert(1)'), "text/html");
		expect(doc.title).toBe(title);
		expect(doc.querySelector("p")?.textContent).toBe(body);
		expect(doc.querySelector("script, img, [onload]")).toBeNull();
	});

	it("preserves technical reminder syntax at diagnostic presentation, not as HTML tags", () => {
		createI18nService();
		for (const raw of [
			"Reminder shorthand must use due:<offset>, scheduled:<offset>, or at:<datetime>",
			"Relative reminders must use due:<offset> or scheduled:<offset> with ISO 8601 durations like -PT1H",
		]) expect(displayError(new Error(raw))).toBe(raw);
		expect(displayError(new Error("Unrecognized external provider detail"))).toBe("Unrecognized external provider detail");
	});

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

	it.each([
		["DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY;INTERVAL=2", "Every 2 days"],
		["DTSTART:20260101T090000Z;FREQ=DAILY;INTERVAL=2", "Every 2 days"],
		["FREQ=MONTHLY;BYDAY=MO;BYSETPOS=-1", "Monthly on the last Monday"],
		["FREQ=MONTHLY;BYDAY=1WE", "Monthly on the 1st Wednesday"],
		["FREQ=MONTHLY;BYDAY=MO", "Monthly on every Monday"],
		["FREQ=MONTHLY;BYDAY=FR;BYSETPOS=2;INTERVAL=3", "Every 3 months on the 2nd Friday"],
		["FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29;INTERVAL=2", "Every 2 years on February 29"],
	])("renders a whole English recurrence phrase for %s", (rule, expected) => {
		createI18nService();
		expect(recurrenceDisplayText(rule)).toBe(expected);
	});

	it.each([0, 1, 2, 5, 21])("formats %s recurrence occurrences with ICU", count => {
		createI18nService();
		expect(recurrenceDisplayText("FREQ=DAILY;COUNT=" + count)).toBe("Daily (" + count + (count === 1 ? " time)" : " times)"));
	});

	it.each(["not a rule", "FREQ=DAILY;BYHOUR=9", "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30", "FREQ=DAILY;UNTIL=20261301", "FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1.5", "FREQ=DAILY\nEXDATE:20260101T090000Z"])("preserves unsupported/malformed recurrence data: %s", rule => {
		createI18nService();
		expect(recurrenceDisplayText(rule)).toBe("Custom recurrence: " + rule);
	});

	it("uses a complete localized month/day rather than an uninflected Russian month", () => {
		createI18nService({ initialLocale: "ru" });
		expect(recurrenceYearlyOn(1, 1)).toContain("1 января");
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
		uiRichText(parent, msg({ message: "<0>.json files:</0> Templates with <1>{example}</1>", context: "webhook JSON template help" }),
			{ example: '<0>user value</0><img src=x onerror="alert(1)">' }, { "0": "strong", "1": "code" });
		expect(parent.querySelectorAll("strong")).toHaveLength(1);
		expect(parent.querySelectorAll("code")).toHaveLength(1);
		expect(parent.querySelector("img")).toBeNull();
		expect(parent.querySelector("code")?.textContent).toBe('<0>user value</0><img src=x onerror="alert(1)">');
	});
});
