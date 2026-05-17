import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";

describe("Issue #1373: TaskNotes passes the calendar locale to NLP parsing", () => {
	it("parses ambiguous slash dates using calendarViewSettings.locale", () => {
		const parser = NaturalLanguageParser.fromPlugin({
			settings: {
				customStatuses: [],
				customPriorities: [],
				nlpDefaultToScheduled: true,
				nlpLanguage: "en",
				nlpTriggers: undefined,
				userFields: [],
				calendarViewSettings: {
					locale: "en-GB",
				},
			},
		} as any);

		const result = parser.parseInput("11/06/2026");

		expect(result.scheduledDate).toBe("2026-06-11");
	});
});
