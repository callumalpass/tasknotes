/**
 * @see https://github.com/callumalpass/tasknotes/issues/1475
 * @see https://github.com/callumalpass/tasknotes/issues/725
 */

import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";

function createParser(): NaturalLanguageParser {
	return new NaturalLanguageParser([], [], true, "en");
}

describe("issues #1475 and #725: NLP literal quote escapes", () => {
	it("keeps quoted course-code hours in the title instead of parsing a time estimate", () => {
		const result = createParser().parseInput('BIO "123H" - HW1');

		expect(result.title).toBe("BIO 123H - HW1");
		expect(result.estimate).toBeUndefined();
	});

	it("keeps quoted date words in the title instead of parsing dates", () => {
		const result = createParser().parseInput('Something "Today"');

		expect(result.title).toBe("Something Today");
		expect(result.scheduledDate).toBeUndefined();
		expect(result.dueDate).toBeUndefined();
	});

	it("supports backtick and single-quote literal spans", () => {
		const backtickResult = createParser().parseInput("Read `tomorrow` magazine");
		const singleQuoteResult = createParser().parseInput("Review 'Today is the Day' book");

		expect(backtickResult.title).toBe("Read tomorrow magazine");
		expect(backtickResult.scheduledDate).toBeUndefined();
		expect(singleQuoteResult.title).toBe("Review Today is the Day book");
		expect(singleQuoteResult.scheduledDate).toBeUndefined();
	});

	it("still parses unquoted NLP outside literal spans", () => {
		const result = createParser().parseInput('Review "BIO 123H" tomorrow 2h');

		expect(result.title).toBe("Review BIO 123H");
		expect(result.scheduledDate).toBeDefined();
		expect(result.estimate).toBe(120);
	});

	it("leaves apostrophes in normal words alone", () => {
		const result = createParser().parseInput("John's task tomorrow");

		expect(result.title).toBe("John's task");
		expect(result.scheduledDate).toBeDefined();
	});
});
