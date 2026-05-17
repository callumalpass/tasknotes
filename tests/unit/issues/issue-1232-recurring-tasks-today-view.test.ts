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

describe("Issue #1232: recurring tasks in the generated Today Base view", () => {
	it("uses format-based day comparisons in Today filters", () => {
		const template = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);

		expect(template).toContain('date(due).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")');
		expect(template).toContain('date(scheduled).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")');
		expect(template).toContain("- due.isEmpty() == false");
		expect(template).toContain("- scheduled.isEmpty() == false");

		expect(template).not.toContain("date(due).date() == today()");
		expect(template).not.toContain("date(scheduled).date() == today()");
	});

	it("normalizes recurring completion dates before checking today's instance", () => {
		const template = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);

		expect(template).toContain(
			'complete_instances.map(date(value).format("YYYY-MM-DD")).contains(today().format("YYYY-MM-DD")) != true'
		);
		expect(template).toContain("- recurrence.isEmpty() == false");

		expect(template).not.toContain('complete_instances.contains(today().format("yyyy-MM-dd"))');
		expect(template).not.toContain('!complete_instances.contains(today().format("yyyy-MM-dd"))');
	});

	it("uses format-based day ranges for This Week filters", () => {
		const template = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);

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

		expect(template).not.toContain("date(due).date() >= today()");
		expect(template).not.toContain("date(scheduled).date() <= today()");
	});
});
