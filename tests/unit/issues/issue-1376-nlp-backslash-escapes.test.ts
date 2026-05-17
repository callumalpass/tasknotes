/**
 * @see https://github.com/callumalpass/tasknotes/issues/1376
 */

import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import type { StatusConfig } from "../../../src/types";

function createParser(statusConfigs: StatusConfig[] = []): NaturalLanguageParser {
	return new NaturalLanguageParser(statusConfigs, [], true, "en");
}

describe("issue #1376: NLP backslash literal escapes", () => {
	it("keeps escaped context triggers in the title", () => {
		const result = createParser().parseInput("Some task \\@ABC");

		expect(result.title).toBe("Some task @ABC");
		expect(result.contexts).toEqual([]);
	});

	it("keeps escaped status triggers in the title without the escape slash", () => {
		const statuses: StatusConfig[] = [
			{
				id: "done",
				value: "done",
				label: "done",
				color: "#008000",
				isCompleted: true,
				order: 1,
			},
		];
		const result = createParser(statuses).parseInput("Some task \\*done");

		expect(result.title).toBe("Some task *done");
		expect(result.status).toBeUndefined();
	});

	it("keeps escaped date words in the title", () => {
		const result = createParser().parseInput("Read \\tomorrow magazine");

		expect(result.title).toBe("Read tomorrow magazine");
		expect(result.scheduledDate).toBeUndefined();
		expect(result.dueDate).toBeUndefined();
	});

	it("keeps escaped time estimates in the title", () => {
		const result = createParser().parseInput("BIO \\123H - HW1");

		expect(result.title).toBe("BIO 123H - HW1");
		expect(result.estimate).toBeUndefined();
	});

	it("does not treat path backslashes as NLP escapes", () => {
		const result = createParser().parseInput("Use C:\\Users folder");

		expect(result.title).toBe("Use C:\\Users folder");
	});

	it("still parses unescaped NLP normally", () => {
		const result = createParser().parseInput("Some task @ABC tomorrow 2h");

		expect(result.title).toBe("Some task");
		expect(result.contexts).toEqual(["ABC"]);
		expect(result.scheduledDate).toBeDefined();
		expect(result.estimate).toBe(120);
	});
});
