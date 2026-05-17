import { generateBasesFileTemplate } from "../../../src/templates/defaultBasesFiles";

const createMockPlugin = (fieldOverrides: Record<string, string> = {}) => {
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
		...fieldOverrides,
	};

	return {
		settings: {
			taskTag: "task",
			taskIdentificationMethod: "tag",
			customPriorities: [
				{ value: "high", label: "High", weight: 0 },
				{ value: "normal", label: "Normal", weight: 1 },
			],
			customStatuses: [
				{ value: "open", label: "Open", isCompleted: false },
				{ value: "done", label: "Done", isCompleted: true },
			],
			defaultVisibleProperties: ["status", "priority", "due", "scheduled"],
			userFields: [],
			fieldMapping,
		},
		fieldMapper: {
			toUserField: jest.fn((key: keyof typeof fieldMapping) => fieldMapping[key] ?? key),
			getMapping: jest.fn(() => fieldMapping),
		},
	};
};

const getTaskListView = (template: string, viewName: string) => {
	const start = template.indexOf(`name: "${viewName}"`);
	expect(start).toBeGreaterThanOrEqual(0);

	const nextView = template.indexOf("\n  - type: tasknotesTaskList", start + 1);
	return nextView === -1 ? template.slice(start) : template.slice(start, nextView);
};

describe("Issue #1231: generated Overdue Base view", () => {
	it("includes tasks whose scheduled date is in the past", () => {
		const template = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);
		const overdueView = getTaskListView(template, "Overdue");

		expect(overdueView).toContain("# Due or scheduled in the past");
		expect(overdueView).toContain("- due.isEmpty() == false");
		expect(overdueView).toContain("- date(due) < today()");
		expect(overdueView).toContain("- scheduled.isEmpty() == false");
		expect(overdueView).toContain("- date(scheduled) < today()");

		expect(overdueView).not.toContain("# Due in the past\n        - date(due) < today()");
	});

	it("uses mapped due and scheduled property names", () => {
		const template = generateBasesFileTemplate(
			"open-tasks-view",
			createMockPlugin({ due: "deadline", scheduled: "start" }) as any
		);
		const overdueView = getTaskListView(template, "Overdue");

		expect(overdueView).toContain("- deadline.isEmpty() == false");
		expect(overdueView).toContain("- date(deadline) < today()");
		expect(overdueView).toContain("- start.isEmpty() == false");
		expect(overdueView).toContain("- date(start) < today()");
	});
});
