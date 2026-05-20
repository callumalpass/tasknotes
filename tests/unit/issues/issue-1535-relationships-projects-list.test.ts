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
	it("normalizes the Subtasks projects property before contains()", () => {
		const template = generateBasesFileTemplate("relationships", createMockPlugin() as any);
		const normalizedProjectLink = String.raw`file(value.replace(/^\[[^\]]+\]\((.*)\)$/, "$1").replace(/%20/g, " ")).asLink()`;

		expect(template).toContain(
			`file.hasLink(this.file) && list(note.projects).map(${normalizedProjectLink}).contains(this.file.asLink())`
		);
		expect(template).not.toContain("note.projects.contains(this.file.asLink())");
	});
});

describe("Issue #1902: relationships project filters handle Markdown project links", () => {
	it("normalizes task project entries in both relationship directions", () => {
		const template = generateBasesFileTemplate("relationships", createMockPlugin() as any);
		const normalizedProjectLink = String.raw`file(value.replace(/^\[[^\]]+\]\((.*)\)$/, "$1").replace(/%20/g, " ")).asLink()`;

		expect(template).toContain(
			`file.hasLink(this.file) && list(note.projects).map(${normalizedProjectLink}).contains(this.file.asLink())`
		);
		expect(template).toContain(
			`list(this.projects).map(${normalizedProjectLink}).contains(file.asLink())`
		);
		expect(template).not.toContain("list(note.projects).contains(this.file.asLink())");
		expect(template).not.toContain("list(this.projects).contains(file.asLink())");
	});
});
