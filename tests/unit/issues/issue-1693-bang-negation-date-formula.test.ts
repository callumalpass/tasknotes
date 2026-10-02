import { parse } from "yaml";
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
		sortOrder: "sort_order",
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

describe("Issue #1693: bang negation on date properties in base formulas", () => {
	it("generates default formulas using date isEmpty checks instead of date truthiness", () => {
		const template = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);

		const { formulas } = parse(template);
		expect(formulas.urgencyScore).toContain(
			`if(due.isEmpty() && scheduled.isEmpty(), formula.priorityWeight`
		);
		expect(formulas.dueDateCategory).toContain(`if(due.isEmpty(), "No due date"`);
		expect(formulas.dueDateDisplay).toContain(`if(due.isEmpty(), ""`);
		expect(formulas.nextDate).toContain(
			`if((due.isEmpty() == false) && (scheduled.isEmpty() == false)`
		);
		expect(formulas.hasDate).toBe(
			`(due.isEmpty() == false) || (scheduled.isEmpty() == false)`
		);

		expect(template).not.toContain("if(!due");
		expect(template).not.toContain("!due && !scheduled");
		expect(template).not.toContain("if(due,");
		expect(template).not.toContain("if(scheduled,");
		expect(template).not.toContain("due && date(due)");
		expect(template).not.toContain("scheduled && date(scheduled)");
	});
});
