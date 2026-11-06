/**
 * @see https://github.com/callumalpass/tasknotes/issues/2489
 *
 * Text inside a wikilink, markdown link, inline code or URL is part of that
 * markup: it stays in the title and is never read as a date, tag or status.
 */

import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { TasksPluginParser } from "../../../src/utils/TasksPluginParser";

// Exercise the installed parser and real date libraries, not the unit-suite stubs.
jest.mock("chrono-node", () => jest.requireActual("../../../node_modules/chrono-node"));
jest.mock("date-fns", () => jest.requireActual("../../../node_modules/date-fns"));

const tomorrow: Record<string, string> = {
	en: "tomorrow", de: "morgen", fr: "demain", es: "mañana", it: "domani", ja: "明日", ru: "завтра",
};

function createParser(language: string): NaturalLanguageParser {
	const s = DEFAULT_SETTINGS;
	return new NaturalLanguageParser(
		s.customStatuses, s.customPriorities, true, language, s.nlpTriggers, s.userFields
	);
}

describe("issue #2489: NLP ignores text inside links and code", () => {
	describe.each(Object.entries(tomorrow))("%s", (language, word) => {
		it.each([
			`[[2026-11-03 Meeting with Jane]]`,
			`[[Meeting ${word} *done #tag @ctx]]`,
			`[2026-11-03 ${word}](<2026-11-03 Meeting.md>)`,
			`https://example.com/2026-11-03/${word}`,
		])("keeps %s whole", (link) => {
			const result = createParser(language).parseInput(`review ${link} ${word}`);

			expect(result.title).toBe(`review ${link}`);
			expect(result.scheduledDate).toBeDefined();
			expect(result.scheduledDate).not.toBe("2026-11-03");
			expect(result.status).toBeUndefined();
			expect(result.tags).toEqual([]);
			expect(result.contexts).toEqual([]);
		});
	});

	it("still applies triggers placed before a link", () => {
		const result = createParser("en").parseInput("review +[[2026-11-03 Meeting]] tomorrow");

		expect(result.title).toBe("review");
		expect(result.projects).toEqual(["[[2026-11-03 Meeting]]"]);
		expect(result.scheduledDate).not.toBe("2026-11-03");
	});

	it("keeps tags and contexts inside links and code in an inline task title", () => {
		const result = TasksPluginParser.parseTaskLine(
			"- [ ] review [[Project#Next steps]] with [Jane](<People/@Jane.md>) `#tag @ctx` #real @home"
		);

		expect(result.parsedData?.title).toBe(
			"review [[Project#Next steps]] with [Jane](<People/@Jane.md>) `#tag @ctx`"
		);
		expect(result.parsedData?.tags).toEqual(["real"]);
		expect(result.parsedData?.contexts).toEqual(["home"]);
	});
});
