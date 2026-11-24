import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import {
	DEFAULT_NLP_TRIGGERS,
	DEFAULT_PRIORITIES,
	DEFAULT_STATUSES,
} from "../../../src/settings/defaults";

jest.mock("chrono-node", () => jest.requireActual("../../../node_modules/chrono-node"));

const parser = new NaturalLanguageParser(
	DEFAULT_STATUSES,
	DEFAULT_PRIORITIES,
	true,
	"en",
	{
		triggers: [
			...DEFAULT_NLP_TRIGGERS.triggers.map((trigger) =>
				trigger.propertyId === "priority" ? { ...trigger, enabled: true } : trigger
			),
			{ propertyId: "reference", trigger: "%:", enabled: true },
		],
	},
	[{ id: "reference", displayName: "Reference", key: "reference", type: "text" }],
	{ referenceDate: new Date(2026, 10, 24, 12) }
);

describe("released natural language spans in the task creation modal", () => {
	it.each([
		["scheduled", "Check May 1", "scheduledDate", undefined],
		["due", "Check due Friday", "dueDate", undefined],
		["recurrence", "Weekly review", "recurrence", undefined],
		["estimate", "Check 30m", "estimate", undefined],
		["priority", "Check !high", "priority", undefined],
		["status", "Check *done", "status", undefined],
		["tag", "Review #2 draft", "tags", []],
		["context", "Check @office", "contexts", []],
		["project", "Check +[[Project A]]", "projects", []],
		["field", "Check %:[[Reference Note]]", "userFields", undefined],
		["field", 'Check %:"two  words"', "userFields", undefined],
	] as const)("keeps a released %s span in the title for %s", (kind, input, field, empty) => {
		const spans = parser.getSpansForModal(input, []);
		expect(spans).toEqual([expect.objectContaining({ kind })]);
		expect(parser.parseInputForModal(input)[field]).not.toEqual(empty);
		const parsed = parser.parseInputForModal(input, spans);
		expect(parsed.title).toBe(input);
		expect(parsed[field]).toEqual(empty);
		expect(parser.getSpansForModal(input, spans)).toEqual([]);
	});

	it("releases only selected occurrences and preserves unrelated span offsets", () => {
		const input = "  📌 #2 and #2 due Friday @office\nMore about #2";
		const spans = parser.getSpansForModal(input, []);
		const released = spans.filter((span, index) => index === 0 || span.kind === "due");
		expect(released.map((span) => span.text)).toEqual(["#2", "due Friday"]);
		expect(parser.getSpansForModal(input, released)).toEqual(
			spans.filter((span) => !released.includes(span))
		);
		expect(parser.parseInputForModal(input, released)).toMatchObject({
			title: "📌 #2 and due Friday",
			tags: ["2"],
			contexts: ["office"],
			details: "More about #2",
		});
		expect(parser.parseInputForModal(input, released).dueDate).toBeUndefined();
	});

	it("keeps a token-only title and leaves ordinary parse calls unchanged", () => {
		const input = "#2";
		const parsed = parser.parseInputForModal(input, parser.getSpansForModal(input, []));
		expect(parsed.title).toBe(input);
		expect(parser.parseInputForModal(input)).toMatchObject({ title: "", tags: ["2"] });
		expect(parser.parseInput(input)).toMatchObject({ title: "Untitled Task", tags: ["2"] });
	});

	it("protects a release when adjacent typing completes a surrounding custom field", () => {
		const input = 'Check %:"May 1" %:other';
		const start = input.indexOf("May 1");
		const released = [{ start, end: start + "May 1".length }];
		expect(parser.parseInputForModal(input, released)).toMatchObject({
			title: 'Check %:"May 1"',
			userFields: { reference: "other" },
		});
		expect(parser.getSpansForModal(input, released).map((span) => span.text)).toEqual([
			"%:other",
		]);
	});

	it("keeps the original details after a line break moves a released range out of the title", () => {
		const input = "Check\n  #2 draft";
		expect(parser.parseInputForModal(input, [{ start: 8, end: 10 }])).toMatchObject({
			title: "Check",
			details: "#2 draft",
			tags: [],
		});
	});

	it("does not mistake private-use characters already in the title for a release marker", () => {
		const input = "Check \uE010\uE011\uE020\uE012 #2";
		expect(parser.parseInputForModal(input, parser.getSpansForModal(input, [])).title).toBe(
			input
		);
	});
});
