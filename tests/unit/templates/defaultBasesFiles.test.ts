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

	it("includes a time-of-day component in urgencyScore so earlier values rank higher", () => {
		// Without the time-of-day term, two tasks at the same priority and same date but
		// different times scored identically and tie-broke on file-iteration order. The
		// 0..1 boost (1 - hourFraction(nextDate)) ranks earlier values above later ones
		// while staying smaller than the priority and days components so cross-day order
		// is preserved.
		const template = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);

		expect(template).toContain(
			`urgencyScore: 'if(!due && !scheduled, formula.priorityWeight, formula.priorityWeight + max(0, 10 - formula.daysUntilNext) + (1 - ((number(date(formula.nextDate)) - number(date(formula.nextDate).date())) / 86400000)))'`
		);

		// Guard against the time-naive form returning
		expect(template).not.toMatch(
			/urgencyScore: 'if\(!due && !scheduled, formula\.priorityWeight, formula\.priorityWeight \+ max\(0, 10 - formula\.daysUntilNext\)\)'/
		);
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
});
