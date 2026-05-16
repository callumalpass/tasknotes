import { generateBasesFileTemplate } from "../../../src/templates/defaultBasesFiles";

const createMockPlugin = (settingsOverride: Record<string, unknown> = {}) => {
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
		pomodoros: "pomodoros",
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
			...settingsOverride,
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

	it("quotes property-based task identifiers so names with spaces work in Bases filters", () => {
		const template = generateBasesFileTemplate(
			"open-tasks-view",
			createMockPlugin({
				taskIdentificationMethod: "property",
				taskPropertyName: "Task Type",
				taskPropertyValue: "task",
			}) as any
		);

		expect(template).toContain('note["Task Type"] == "task"');
		expect(template).not.toContain("note.Task Type");
	});

	it("keeps boolean task identifier values unquoted when using a quoted property reference", () => {
		const template = generateBasesFileTemplate(
			"open-tasks-view",
			createMockPlugin({
				taskIdentificationMethod: "property",
				taskPropertyName: "Task Type",
				taskPropertyValue: "true",
			}) as any
		);

		expect(template).toContain('note["Task Type"] == true');
		expect(template).not.toContain('note["Task Type"] == "true"');
	});

	it("uses the same quoted property reference for property existence filters", () => {
		const template = generateBasesFileTemplate(
			"open-tasks-view",
			createMockPlugin({
				taskIdentificationMethod: "property",
				taskPropertyName: "Task Type",
				taskPropertyValue: "",
			}) as any
		);

		expect(template).toContain(
			'note["Task Type"] && note["Task Type"] != "" && note["Task Type"] != null'
		);
		expect(template).not.toContain("note.Task Type");
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
			`isDueThisWeek: '(due.isEmpty() == false) && date(due).date() >= today() && date(due).date() <= today() + "7d"'`
		);
		expect(template).toContain(
			`isThisWeek: '((due.isEmpty() == false) && date(due).date() >= today() && date(due).date() <= today() + "7d") || ((scheduled.isEmpty() == false) && date(scheduled).date() >= today() && date(scheduled).date() <= today() + "7d")'`
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

	it("includes a time-of-day component in urgencyScore so earlier values rank higher", () => {
		// Without the time-of-day term, two tasks at the same priority and same date but
		// different times scored identically and tie-broke on file-iteration order. The
		// 0..1 boost (1 - hourFraction(nextDate)) ranks earlier values above later ones
		// while staying smaller than the priority and days components so cross-day order
		// is preserved.
		const template = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);

		expect(template).toContain(
			`urgencyScore: 'if(due.isEmpty() && scheduled.isEmpty(), formula.priorityWeight, formula.priorityWeight + max(0, 10 - if(formula.daysUntilNext, formula.daysUntilNext, 0)) + (1 - ((number(date(formula.nextDate)) - number(date(formula.nextDate).date())) / 86400000)))'`
		);

		// Guard against the time-naive form returning
		expect(template).not.toMatch(
			/urgencyScore: 'if\(!due && !scheduled, formula\.priorityWeight, formula\.priorityWeight \+ max\(0, 10 - formula\.daysUntilNext\)\)'/
		);
	});

	it("uses isEmpty guards instead of date property truthiness in generated formulas", () => {
		const template = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);

		expect(template).toContain("due.isEmpty()");
		expect(template).toContain("scheduled.isEmpty()");
		expect(template).toContain(
			`nextDateCategory: 'if(due.isEmpty() && scheduled.isEmpty(), "No date"`
		);
		expect(template).toContain(
			`hasDate: '(due.isEmpty() == false) || (scheduled.isEmpty() == false)'`
		);
		expect(template).not.toContain("!due");
		expect(template).not.toContain("!scheduled");
		expect(template).not.toContain("if(due,");
		expect(template).not.toContain("if(scheduled,");
	});

	it("time-of-day boost is monotonic and bounded in [0, 1]", () => {
		// Verifies the math invariant the formula relies on, independent of YAML shape.
		// boost = 1 - fractional_day(ms_since_epoch). A given Date earlier in its day
		// must yield a strictly larger boost than the same date later in the day.
		const boost = (iso: string) => {
			const ms = Date.parse(iso);
			const dayMs = ms / 86_400_000;
			return 1 - (dayMs - Math.floor(dayMs));
		};

		expect(boost("2026-04-28T00:00:00Z")).toBe(1);
		expect(boost("2026-04-28T09:00:00Z")).toBeCloseTo(0.625, 3);
		expect(boost("2026-04-28T17:00:00Z")).toBeCloseTo(0.292, 3);
		expect(boost("2026-04-28T23:59:59Z")).toBeGreaterThan(0);
		expect(boost("2026-04-28T23:59:59Z")).toBeLessThanOrEqual(1 / 86_400);

		// Monotonic: earlier in day → larger boost.
		expect(boost("2026-04-28T09:00:00Z")).toBeGreaterThan(boost("2026-04-28T17:00:00Z"));
	});

	it("generates a Pomodoro statistics Base from daily-note Pomodoro frontmatter", () => {
		const template = generateBasesFileTemplate("pomodoro-stats-base", createMockPlugin() as any);

		expect(template).toContain("# Pomodoro statistics");
		expect(template).toContain('file.hasProperty("pomodoros")');
		expect(template).toContain('note["pomodoros"]');
		expect(template).toContain('name: "Daily"');
		expect(template).toContain('name: "Monthly"');
		expect(template).toContain("groupBy:\n      property: formula.pomodoroMonth");
		expect(template).toContain("formula.completedPomos: Sum");
		expect(template).toContain("formula.focusMinutes: Sum");
		expect(template).not.toContain('file.hasTag("task")');
	});
});
