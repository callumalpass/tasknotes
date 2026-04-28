import { generateBasesFileTemplate } from "../../../src/templates/defaultBasesFiles";

const createMockPlugin = () => {
	const fieldMapping = {
		status: "status",
		priority: "priority",
		due: "due",
		scheduled: "scheduled",
		projects: "projects",
		contexts: "contexts",
		recurrence: "recurrence",
		completeInstances: "complete_instances",
		blockedBy: "blockedBy",
		sortOrder: "tasknotes_manual_order",
		timeEstimate: "timeEstimate",
		timeEntries: "timeEntries",
	};

	return {
		settings: {
			taskTag: "task",
			taskIdentificationMethod: "tag",
			customPriorities: [
				{ value: "high", label: "High", weight: 0 },
				{ value: "normal", label: "Normal", weight: 1 },
				{ value: "low", label: "Low", weight: 2 },
			],
			customStatuses: [
				{ value: "open", label: "Open", isCompleted: false },
				{ value: "done", label: "Done", isCompleted: true },
			],
			defaultVisibleProperties: ["status", "priority", "due"],
			userFields: [],
			fieldMapping,
		},
		fieldMapper: {
			toUserField: jest.fn((key: keyof typeof fieldMapping) => fieldMapping[key] ?? key),
			getMapping: jest.fn(() => fieldMapping),
		},
	};
};

describe("defaultBasesFiles", () => {
	it("adds manual-order sorting to the default kanban template", () => {
		const template = generateBasesFileTemplate("open-kanban-view", createMockPlugin() as any);

		expect(template).toContain('name: "Kanban Board"');
		expect(template).toContain("sort:\n      - column: tasknotes_manual_order\n        direction: DESC");
		expect(template).toContain("groupBy:\n      property: status");
	});

	it("adds a dedicated manual-order task list view while preserving urgency views", () => {
		const template = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);

		expect(template).toContain('name: "Manual Order"');
		expect(template).toContain("sort:\n      - column: tasknotes_manual_order\n        direction: DESC");
		expect(template).toContain("groupBy:\n      property: status");
		expect(template).toContain('name: "Not Blocked"');
		expect(template).toContain("sort:\n      - column: formula.urgencyScore\n        direction: DESC");
	});

	it("adds manual-order sorting to relationship views that render tasks", () => {
		const template = generateBasesFileTemplate("relationships", createMockPlugin() as any);

		expect(template).toContain('name: "Subtasks"');
		expect(template).toContain('name: "Blocked By"');
		expect(template).toContain('name: "Blocking"');
		expect((template.match(/column: tasknotes_manual_order/g) ?? []).length).toBe(3);
		expect(template).toContain('name: "Projects"');
	});

	it("strips time component in view filters and formulas that compare against today()", () => {
		// today() returns midnight in the Bases formula language. Without .date(),
		// equality comparisons (date(x) == today()) never match a value that carries
		// a time, and upper-bound window checks (date(x) <= today() + "7d") drop the
		// last day of the window for any value past midnight. Calling .date() on the
		// left side strips the time so every comparison runs at day-level granularity.
		const template = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);

		// Today and This Week view filters
		expect(template).toContain("date(due).date() == today()");
		expect(template).toContain("date(scheduled).date() == today()");
		expect(template).toContain("date(due).date() >= today()");
		expect(template).toContain('date(due).date() <= today() + "7 days"');
		expect(template).toContain("date(scheduled).date() >= today()");
		expect(template).toContain('date(scheduled).date() <= today() + "7 days"');

		// Pin full bodies of the affected formulas so a regression in any single
		// clause (lower bound, upper bound, due half, scheduled half) breaks the test.
		expect(template).toContain(
			`isDueThisWeek: 'due && date(due).date() >= today() && date(due).date() <= today() + "7d"'`
		);
		expect(template).toContain(
			`isThisWeek: '(due && date(due).date() >= today() && date(due).date() <= today() + "7d") || (scheduled && date(scheduled).date() >= today() && date(scheduled).date() <= today() + "7d")'`
		);

		// Negative guards against any reappearance of the time-naive shape on a
		// single comparison side (the formula pins above already protect the full
		// expressions; these catch edits that introduce the bug elsewhere).
		expect(template).not.toMatch(/date\(due\) == today\(\)/);
		expect(template).not.toMatch(/date\(scheduled\) == today\(\)/);
		expect(template).not.toMatch(/date\(due\) >= today\(\)/);
		expect(template).not.toMatch(/date\(scheduled\) >= today\(\)/);
		expect(template).not.toMatch(/date\(due\) <= today\(\) \+ "7d"/);
		expect(template).not.toMatch(/date\(scheduled\) <= today\(\) \+ "7d"/);
	});
});
