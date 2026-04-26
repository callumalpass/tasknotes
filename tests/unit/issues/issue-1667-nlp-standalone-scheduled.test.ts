import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";

describe("Issue #1667: standalone scheduled NLP triggers", () => {
	it("sets scheduled and due dates from standalone scheduled and due triggers", () => {
		const parser = new NaturalLanguageParser([], [], false);

		const result = parser.parseInput("Write report scheduled 2026-05-01 due 2026-05-13");

		expect(result.title).toBe("Write report");
		expect(result.scheduledDate).toBe("2026-05-01");
		expect(result.dueDate).toBe("2026-05-13");
	});

	it("sets scheduled and due dates from standalone start and due triggers", () => {
		const parser = new NaturalLanguageParser([], [], false);

		const result = parser.parseInput("Write report start 2026-05-01 due 2026-05-13");

		expect(result.title).toBe("Write report");
		expect(result.scheduledDate).toBe("2026-05-01");
		expect(result.dueDate).toBe("2026-05-13");
	});

	it("does not match scheduled triggers inside longer words", () => {
		const parser = new NaturalLanguageParser([], [], false);

		const result = parser.parseInput("Write report started 2026-05-01");

		expect(result.title).toBe("Write report started");
		expect(result.scheduledDate).toBeUndefined();
		expect(result.dueDate).toBe("2026-05-01");
	});
});
