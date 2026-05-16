import { generateBasesFileTemplate } from "../../../src/templates/defaultBasesFiles";

function createMockPlugin() {
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
			defaultVisibleProperties: ["status", "priority", "due", "scheduled"],
			userFields: [],
			fieldMapping,
		},
		fieldMapper: {
			toUserField: jest.fn((key: keyof typeof fieldMapping) => fieldMapping[key] ?? key),
			getMapping: jest.fn(() => fieldMapping),
		},
	};
}

describe("Issue #1535: relationships project filters handle single Link values", () => {
	it("wraps the Subtasks projects property with list() before contains()", () => {
		const template = generateBasesFileTemplate("relationships", createMockPlugin() as any);

		expect(template).toContain("list(note.projects).contains(this.file.asLink())");
		expect(template).not.toContain("note.projects.contains(this.file.asLink())");
	});
});
