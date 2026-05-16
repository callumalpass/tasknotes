import { KanbanView } from "../../../src/bases/KanbanView";
import type { PriorityConfig } from "../../../src/types";

const priorities: PriorityConfig[] = [
	{ id: "low", value: "low", label: "Low", color: "#999999", weight: 10 },
	{ id: "urgent", value: "urgent", label: "Urgent", color: "#ff0000", weight: 30 },
	{ id: "normal", value: "normal", label: "Normal", color: "#00ff00", weight: 20 },
];

function makePlugin() {
	return {
		app: {},
		fieldMapper: {
			toUserField: (field: string) => field,
			isRecognizedProperty: () => true,
		},
		priorityManager: {
			getAllPriorities: () => priorities,
			getPriorityWeight: (value: string) =>
				priorities.find((priority) => priority.value === value)?.weight ?? 0,
		},
		statusManager: {
			getStatusOrder: () => 0,
		},
		settings: {
			customStatuses: [],
			fieldMapping: {
				sortOrder: "sort_order",
			},
		},
	};
}

function makeView(): KanbanView {
	return new KanbanView({}, document.createElement("div"), makePlugin() as any);
}

describe("Issue #1474: Kanban priority swimlane order", () => {
	it("orders priority swimlanes by configured priority weight", () => {
		const view = makeView();

		const ordered = (view as any).applySwimLaneOrder("task.priority", [
			"low",
			"urgent",
			"normal",
		]);

		expect(ordered).toEqual(["urgent", "normal", "low"]);
	});
});
