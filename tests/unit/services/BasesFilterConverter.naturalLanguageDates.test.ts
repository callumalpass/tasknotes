import { BasesFilterConverter } from "../../../src/services/BasesFilterConverter";
import { getNaturalLanguageDateOffsetDays } from "../../../src/utils/dateUtils";
import type { FilterOperator, FilterProperty, FilterQuery } from "../../../src/types";

function makeConverter(userFields: unknown[] = []) {
	return new BasesFilterConverter({
		fieldMapper: { toUserField: (key: string) => key },
		settings: { userFields },
	} as any);
}

function convert(
	property: FilterProperty | string,
	operator: FilterOperator,
	value: unknown,
	userFields: unknown[] = []
): unknown {
	const query = {
		type: "group",
		id: "root",
		conjunction: "and",
		children: [{ type: "condition", id: "c1", property, operator, value }],
	} as unknown as FilterQuery;
	return makeConverter(userFields).convertToBasesFilter(query);
}

const DAY = `format("YYYY-MM-DD")`;

describe("BasesFilterConverter natural language dates", () => {
	it("converts 'is today' to a date-part comparison with today()", () => {
		expect(convert("due", "is", "today")).toBe(
			`(!note.due.isEmpty() && date(note.due).${DAY} == today().${DAY})`
		);
	});

	it.each<[FilterOperator, string]>([
		["is-before", "<"],
		["is-after", ">"],
		["is-on-or-before", "<="],
		["is-on-or-after", ">="],
	])(
		"converts '%s today' to a date comparison instead of a string comparison",
		(operator, cmp) => {
			expect(convert("due", operator, "today")).toBe(
				`(!note.due.isEmpty() && date(note.due).${DAY} ${cmp} today().${DAY})`
			);
		}
	);

	it("negates 'is-not today'", () => {
		expect(convert("scheduled", "is-not", "Today")).toBe(
			`!(!note.scheduled.isEmpty() && date(note.scheduled).${DAY} == today().${DAY})`
		);
	});

	it.each([
		["tomorrow", `(today() + "1 day")`],
		["yesterday", `(today() - "1 day")`],
		["next week", `(today() + "7 days")`],
		["in 3 days", `(today() + "3 days")`],
		["2 weeks ago", `(today() - "14 days")`],
	])("converts '%s' relative to today()", (value, relativeDate) => {
		expect(convert("due", "is-on-or-before", value)).toBe(
			`(!note.due.isEmpty() && date(note.due).${DAY} <= ${relativeDate}.${DAY})`
		);
	});

	it("uses file timestamps for created and modified dates", () => {
		expect(convert("dateCreated", "is", "today")).toBe(
			`(!file.ctime.isEmpty() && date(file.ctime).${DAY} == today().${DAY})`
		);
	});

	it("supports user date fields", () => {
		const userFields = [{ id: "review", key: "reviewDate", type: "date" }];
		expect(convert("user:review", "is", "today", userFields)).toBe(
			`(!note.reviewDate.isEmpty() && date(note.reviewDate).${DAY} == today().${DAY})`
		);
	});

	it("keeps literal dates and non-date properties unchanged", () => {
		expect(convert("due", "is-on-or-before", "2026-10-15")).toBe(`note.due <= "2026-10-15"`);
		expect(convert("status", "is", "today")).toBe(`note.status == "today"`);
	});
});

describe("getNaturalLanguageDateOffsetDays", () => {
	it.each([
		["today", 0],
		[" TODAY ", 0],
		["tomorrow", 1],
		["yesterday", -1],
		["last week", -7],
		["in 1 day", 1],
		["5 days ago", -5],
		["in 2 weeks", 14],
		["1 week ago", -7],
	])("returns the offset for '%s'", (value, offset) => {
		expect(getNaturalLanguageDateOffsetDays(value)).toBe(offset);
	});

	it.each(["", "2026-10-15", "next month", "someday"])("returns null for '%s'", (value) => {
		expect(getNaturalLanguageDateOffsetDays(value)).toBeNull();
	});
});
