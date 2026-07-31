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
		recurrenceParent: "recurrence_parent",
		occurrenceDate: "occurrence_date",
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
		expect(template).toContain('name: "Occurrences"');
		expect(template).toContain('name: "Blocked By"');
		expect(template).toContain('name: "Blocking"');
		expect((template.match(/column: tasknotes_manual_order/g) ?? []).length).toBe(3);
		expect(template).toContain('name: "Projects"');
	});

	it("adds materialized occurrence notes to the relationships template", () => {
		const template = generateBasesFileTemplate("relationships", createMockPlugin() as any);

		expect(template).toContain('name: "Occurrences"');
		expect(template).toContain(
			'file.hasLink(this.file) && note.recurrence_parent && file(note.recurrence_parent.replace(/^\\[[^\\]]+\\]\\((.*)\\)$/, "$1").replace(/%20/g, " ")).asLink() == this.file.asLink()'
		);
		expect(template).toContain("      - file.tasks\n      - occurrence_date");
		expect(template).toContain("      - column: occurrence_date\n        direction: ASC");
	});

	it("normalizes dependency entries in generated Bases filters before comparing links", () => {
		const tasksTemplate = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);
		const relationshipsTemplate = generateBasesFileTemplate(
			"relationships",
			createMockPlugin() as any
		);

		const dependencyFileExpression = 'file(if(value.isType("object"), value.uid, value))';
		const dependencyLinkExpression = `${dependencyFileExpression}.asLink()`;

		expect(tasksTemplate).toContain(
			`list(blockedBy).filter(${dependencyFileExpression}.properties.status != "done").isEmpty()`
		);
		expect(relationshipsTemplate).toContain(
			`list(this.note.blockedBy).map(${dependencyLinkExpression}).contains(file.asLink())`
		);
		expect(relationshipsTemplate).toContain(
			`list(note.blockedBy).map(${dependencyLinkExpression}).contains(this.file.asLink())`
		);

		expect(tasksTemplate).not.toContain("file(value.uid)");
		expect(relationshipsTemplate).not.toContain(".map(value.uid)");
	});

	it("adds a due-in countdown to the default agenda template", () => {
		const template = generateBasesFileTemplate("open-agenda-view", createMockPlugin() as any);

		expect(template).toContain('dueIn: \'if(due.isEmpty(), "", if(formula.daysUntilDue == 0');
		expect(template).toContain("formula.dueIn:\n    displayName: Due in");
		expect(template).toContain("      - due\n      - formula.dueIn\n      - file.name");
		expect(template).toContain('calendarView: "listWeek"');
		expect(template).toContain("listDayCount: 7");
	});

	it("lets generated calendar views inherit app-level time bounds", () => {
		const template = generateBasesFileTemplate(
			"open-advanced-calendar-view",
			createMockPlugin() as any
		);

		expect(template).toContain('calendarView: "timeGridWeek"');
		expect(template).toContain('slotDuration: "00:30:00"');
		expect(template).not.toContain("slotMinTime");
		expect(template).not.toContain("slotMaxTime");
	});

	it("does not force the due-in agenda property when due dates are hidden by default", () => {
		const template = generateBasesFileTemplate(
			"open-agenda-view",
			createMockPlugin({ defaultVisibleProperties: ["status", "priority"] }) as any
		);

		expect(template).not.toContain("      - formula.dueIn");
		expect(template).not.toContain("formula.dueIn:\n    displayName: Due in");
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

	it("uses tag membership when property-based task identification targets tags (#1156)", () => {
		const template = generateBasesFileTemplate(
			"open-tasks-view",
			createMockPlugin({
				taskIdentificationMethod: "property",
				taskPropertyName: "tags",
				taskPropertyValue: "task",
			}) as any
		);

		expect(template).toContain('file.hasTag("task")');
		expect(template).not.toContain('note["tags"] == "task"');
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

	it("adds excluded folder filters to generated task Bases", () => {
		const template = generateBasesFileTemplate(
			"open-tasks-view",
			createMockPlugin({
				excludedFolders:
					'Templates, 8 PKM organization/83 PKM templates/831 Full templates, Folder "Quoted", Templates',
			}) as any
		);

		expect(template).toContain(
			[
				"filters:",
				"  and:",
				'    - file.hasTag("task")',
				'    - file.inFolder("Templates") != true',
				'    - file.inFolder("8 PKM organization/83 PKM templates/831 Full templates") != true',
				'    - file.inFolder("Folder \\"Quoted\\"") != true',
			].join("\n")
		);
		expect((template.match(/file\.inFolder\("Templates"\) != true/g) ?? []).length).toBe(1);
	});

	it("adds excluded folder filters to generated relationship views", () => {
		const template = generateBasesFileTemplate(
			"relationships",
			createMockPlugin({
				excludedFolders: "Templates",
			}) as any
		);

		expect(template).toContain(
			[
				'name: "Subtasks"',
				"    filters:",
				"      and:",
				'        - file.hasTag("task")',
				'        - file.inFolder("Templates") != true',
				"        - file.hasLink(this.file)",
			].join("\n")
		);
		expect(template).toContain(
			[
				'name: "Projects"',
				"    filters:",
				"      and:",
				'        - file.inFolder("Templates") != true',
				"        - list(this.projects)",
			].join("\n")
		);
		expect(template).toContain(
			[
				'name: "Occurrences"',
				"    filters:",
				"      and:",
				'        - file.hasTag("task")',
				'        - file.inFolder("Templates") != true',
				"        - file.hasLink(this.file)",
			].join("\n")
		);
		expect((template.match(/file\.inFolder\("Templates"\) != true/g) ?? []).length).toBe(5);
	});

	it("uses formatted day strings in view filters and formulas that compare against today()", () => {
		// Bases date values may carry time, while today() is a day boundary.
		// Comparing both sides as YYYY-MM-DD strings keeps filters day-granular
		// without relying on date().date(), which returns a day number in Bases.
		const template = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);

		// Today and This Week view filters
		expect(template).toContain('date(due).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")');
		expect(template).toContain(
			'date(scheduled).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")'
		);
		expect(template).toContain('date(due).format("YYYY-MM-DD") >= today().format("YYYY-MM-DD")');
		expect(template).toContain(
			'date(due).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD")'
		);
		expect(template).toContain(
			'date(scheduled).format("YYYY-MM-DD") >= today().format("YYYY-MM-DD")'
		);
		expect(template).toContain(
			'date(scheduled).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD")'
		);

		// Pin full bodies of the affected formulas so a regression in any single
		// clause (lower bound, upper bound, due half, scheduled half) breaks the test.
		expect(template).toContain(
			`isDueThisWeek: '(due.isEmpty() == false) && date(due).format("YYYY-MM-DD") >= today().format("YYYY-MM-DD") && date(due).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD")'`
		);
		expect(template).toContain(
			`isThisWeek: '((due.isEmpty() == false) && date(due).format("YYYY-MM-DD") >= today().format("YYYY-MM-DD") && date(due).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD")) || ((scheduled.isEmpty() == false) && date(scheduled).format("YYYY-MM-DD") >= today().format("YYYY-MM-DD") && date(scheduled).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD"))'`
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
		expect(template).not.toContain("date(due).date() == today()");
		expect(template).not.toContain("date(scheduled).date() == today()");
	});

	it("includes a time-of-day component in urgencyScore so earlier values rank higher", () => {
		// Without the time-of-day term, two tasks at the same priority and same date but
		// different times scored identically and tie-broke on file-iteration order. The
		// 0..1 boost (1 - hourFraction(nextDate)) ranks earlier values above later ones
		// while staying smaller than the priority and days components so cross-day order
		// is preserved.
		const template = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);

		expect(template).toContain(
			`urgencyScore: 'if(due.isEmpty() && scheduled.isEmpty(), formula.priorityWeight, formula.priorityWeight + max(0, 10 - if(formula.daysUntilNext, formula.daysUntilNext, 0)) + (1 - ((number(date(formula.nextDate)) - number(date(date(formula.nextDate).format("YYYY-MM-DD")))) / 86400000)))'`
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
