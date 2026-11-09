import { parse } from "yaml";
import { generateBasesFileTemplate } from "../../../src/templates/defaultBasesFiles";
import { BasesFilterConverter } from "../../../src/services/BasesFilterConverter";

// In Obsidian Bases, `!prop` and `list(prop).length` are null (not true/0) when the
// property is missing, so generated emptiness checks must use isEmpty().
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
		timeEntries: "time_entries",
	};

	return {
		settings: {
			taskTag: "task",
			taskIdentificationMethod: "tag",
			customPriorities: [{ value: "normal", label: "Normal", weight: 1 }],
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

describe("Issue #2524: generated emptiness checks use isEmpty()", () => {
	it("tests time entries and time estimate with isEmpty() instead of negation", () => {
		const template = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);
		const { formulas } = parse(template);

		expect(formulas.trackingStatus).toBe(
			'if(timeEstimate.isEmpty() || timeEstimate == 0, "No estimate", if(time_entries.isEmpty(), "Not started", if(formula.efficiencyRatio < 100, "Under estimate", "Over estimate")))'
		);
		expect(formulas.timeEstimateCategory).toMatch(
			/^if\(timeEstimate\.isEmpty\(\) \|\| timeEstimate == 0, "No estimate", /
		);

		for (const [name, formula] of Object.entries(formulas as Record<string, string>)) {
			expect({ name, negatesProperty: /(^|[(,|&\s])!\w+\s*\|\|/.test(formula) }).toEqual({
				name,
				negatesProperty: false,
			});
		}
	});

	it("exports an empty list filter as isEmpty()", () => {
		const converter = new BasesFilterConverter({
			fieldMapper: { toUserField: (key: string) => key },
			settings: { userFields: [] },
		} as any);

		expect(
			converter.convertToBasesFilter({
				type: "group",
				id: "root",
				conjunction: "and",
				children: [
					{ type: "condition", id: "c1", property: "contexts", operator: "is", value: [] },
				],
			} as any)
		).toBe("note.contexts.isEmpty()");
	});
});
