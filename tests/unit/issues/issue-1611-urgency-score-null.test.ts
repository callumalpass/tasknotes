/**
 * Regression coverage for Issue #1611: formula.urgencyScore not working as expected
 *
 * The urgencyScore formula returns null when daysUntilNext evaluates to null,
 * because max(0, 10 - null) propagates null. This breaks sort ordering in
 * all default base views that sort by urgencyScore.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1611
 */

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

describe("Issue #1611: formula.urgencyScore null propagation", () => {
	it("falls back when daysUntilNext is null while preserving time-of-day ranking", () => {
		const template = generateBasesFileTemplate("open-tasks-view", createMockPlugin() as any);

		expect(template).toContain(
			"max(0, 10 - if(formula.daysUntilNext, formula.daysUntilNext, 0))"
		);
		expect(template).toContain(
			"(1 - ((number(date(formula.nextDate)) - number(date(formula.nextDate).date())) / 86400000))"
		);

		expect(template).not.toContain("max(0, 10 - formula.daysUntilNext)");
	});
});
