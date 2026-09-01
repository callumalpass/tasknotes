import {
	applyDefaultKanbanSwimLaneOrder,
	applyKanbanSwimLaneOrder,
} from "../../../src/bases/kanbanGrouping";

describe("Issue #2256: Bases sort drives swimlane row order", () => {
	const genericOptions = {
		swimLanePropertyId: "note.projects" as string | null,
		isPriorityField: () => false,
		isStatusField: () => false,
		getPriorityWeight: () => 0,
		getStatusOrder: () => 0,
	};

	it("preserves encounter order (derived from the Bases sort) instead of sorting alphabetically", () => {
		// Encounter order comes from iterating Bases-sorted tasks: the swimlane
		// holding the first (nearest due) task must stay on top.
		const actualKeys = ["project b", "project a", "project c"];

		expect(applyDefaultKanbanSwimLaneOrder({ ...genericOptions, actualKeys })).toEqual([
			"project b",
			"project a",
			"project c",
		]);
	});

	it("does not flatten a single-key difference into alphabetical order", () => {
		const actualKeys = ["zeta", "alpha"];

		expect(applyDefaultKanbanSwimLaneOrder({ ...genericOptions, actualKeys })).toEqual([
			"zeta",
			"alpha",
		]);
	});

	it("still appends keys missing from a configured order in encounter order", () => {
		const ordered = applyKanbanSwimLaneOrder({
			swimLanePropertyId: "note.projects",
			actualKeys: ["late", "early"],
			swimLaneOrders: { "note.projects": ["early"] },
			hideEmptySwimLanes: false,
			...genericOptions,
			isPriorityField: genericOptions.isPriorityField,
			isStatusField: genericOptions.isStatusField,
		});

		expect(ordered).toEqual(["early", "late"]);
	});

	it("keeps priority swimlanes ordered by weight regardless of encounter order", () => {
		const ordered = applyKanbanSwimLaneOrder({
			swimLanePropertyId: "task.priority",
			actualKeys: ["low", "high"],
			swimLaneOrders: {},
			hideEmptySwimLanes: false,
			isPriorityField: (propertyId) => propertyId === "task.priority",
			isStatusField: () => false,
			getPriorityWeight: (key) => ({ high: 3, medium: 2, low: 1 })[key] ?? 0,
			getStatusOrder: () => 0,
		});

		expect(ordered).toEqual(["high", "low"]);
	});
});
