import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";

// Exercise the real dependency pipeline, not the suite's simplified Chrono/date mocks.
jest.mock("chrono-node", () => jest.requireActual("../../../node_modules/chrono-node/dist/cjs/index.js"));
jest.mock("date-fns", () => jest.requireActual("../../../node_modules/date-fns"));

const triggers = { triggers: [
	{ propertyId: "tags", trigger: "#", enabled: true },
	{ propertyId: "contexts", trigger: "@", enabled: true },
	{ propertyId: "projects", trigger: "+", enabled: true },
	{ propertyId: "reference", trigger: "/", enabled: true },
] };
const fields = [{ id: "reference", key: "reference", displayName: "Reference", type: "list" as const }];
const parser = (language = "en") => new NaturalLanguageParser([], [], true, language, triggers, fields);

describe("shared capture parser 0.2.0 integration", () => {
	it.each(["Send jane+work@example.com email", "Visit https://example.com/path#section", "Visit https://example.com/@user/path", "Learn C++programming"])("preserves ordinary selector-adjacent text: %s", input => {
		const result = parser().parseInput(input);
		expect(result.title).toBe(input);
		expect(result.projects).toEqual([]);
		expect(result.contexts).toEqual([]);
		expect(result.tags).toEqual([]);
	});
	it("checks original positions, not boundaries exposed by removing earlier tokens", () => {
		const result = parser().parseInput("Task @work+project");
		expect(result.title).toBe("Task +project");
		expect(result.projects).toEqual([]);
		expect(result.contexts).toEqual(["work"]);
	});
	it.each(['"', "'", "`"])("restores nested wikilinks inside %s literals", quote => {
		const result = parser().parseInput(`Review ${quote}[[Email@domain.com]]${quote} /${quote}[[Reference @ Work]]${quote}`);
		expect(result.title).toBe("Review [[Email@domain.com]]");
		expect(result.userFields?.reference).toEqual(["[[Reference @ Work]]"]);
		expect(JSON.stringify(result)).not.toContain("__TASKNOTES_NLP_LITERAL_");
	});
	it("extracts repeated project prefixes without rewriting protected links or details", () => {
		const result = parser().parseInput("Test-03 ++personal [[Note ++literal]]\nAdd ++personal to notes");
		expect(result.title).toBe("Test-03 [[Note ++literal]]");
		expect(result.projects).toEqual(["+personal"]);
		expect(result.details).toBe("Add ++personal to notes");
	});
	describe("Italian relative dates", () => {
		beforeEach(() => jest.useFakeTimers().setSystemTime(new Date(2026, 7, 29, 12)));
		afterEach(() => jest.useRealTimers());
		it("supports due and scheduled relative dates using the local calendar", () => {
			const result = parser("it").parseInput("Comprare pane programmato per oggi entro dopodomani");
			expect(result.title).toBe("Comprare pane");
			expect(result.scheduledDate).toBe("2026-08-29");
			expect(result.dueDate).toBe("2026-08-31");
			expect(parser("it").parseInput("Comprare pane per domani").dueDate).toBe("2026-08-30");
		});
		it.each([
			["Rivedere [[oggi]]", "Rivedere [[oggi]]"],
			["Rivedere +[[domani]]", "Rivedere"],
			["Rivedere #domani", "Rivedere"],
			["Rivedere @oggi", "Rivedere"],
			["Rivedere \\oggi", "Rivedere oggi"],
			["Rivedere àoggi", "Rivedere àoggi"],
			["Rivedere\noggi è il titolo del documento", "Rivedere"],
		])("preserves non-date uses: %s", (input, title) => {
			const result = parser("it").parseInput(input);
			expect(result.title).toBe(title);
			expect(result.scheduledDate).toBeUndefined();
			expect(result.dueDate).toBeUndefined();
		});
		it("does not mistake ordinary apostrophes for quoted spans", () => {
			const result = parser("it").parseInput("L'amico arriva oggi e l'altro domani");
			expect(result.scheduledDate).toBe("2026-08-29");
			expect(result.title).toBe("L'amico arriva e l'altro domani");
		});
	});
});
