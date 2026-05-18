import { KanbanView } from "../../../src/bases/KanbanView";
import { PriorityManager } from "../../../src/services/PriorityManager";
import { StatusManager } from "../../../src/services/StatusManager";
import type { PriorityConfig, StatusConfig } from "../../../src/types";

const STATUSES: StatusConfig[] = [
	{
		id: "open",
		value: "open",
		label: "Open",
		color: "#3b82f6",
		isCompleted: false,
		order: 1,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
	{
		id: "in-progress",
		value: "in-progress",
		label: "In progress",
		color: "#f59e0b",
		isCompleted: false,
		order: 2,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
	{
		id: "done",
		value: "done",
		label: "Done",
		color: "#16a34a",
		isCompleted: true,
		order: 3,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
];

const PRIORITIES: PriorityConfig[] = [
	{ id: "low", value: "low", label: "Low", color: "#22c55e", weight: 1 },
	{ id: "normal", value: "normal", label: "Normal", color: "#3b82f6", weight: 2 },
	{ id: "high", value: "high", label: "High", color: "#ef4444", weight: 3 },
];

function makePlugin() {
	return {
		app: {},
		fieldMapper: {
			toUserField: (field: string) => field,
			isRecognizedProperty: () => true,
		},
		statusManager: new StatusManager(STATUSES, "open"),
		priorityManager: new PriorityManager(PRIORITIES),
		settings: {
			customStatuses: STATUSES,
			fieldMapping: {
				sortOrder: "sort_order",
			},
		},
	};
}

function makeView(): KanbanView {
	return new KanbanView({}, document.createElement("div"), makePlugin() as any);
}

describe("Issue #239: Kanban status and priority column order", () => {
	it("orders status columns by configured status order when no manual order is saved", () => {
		const view = makeView();
		(view as any).columnOrders = {};
		(view as any).pinnedColumns = [];

		const ordered = (view as any).applyColumnOrder("status", [
			"done",
			"None",
			"open",
			"in-progress",
		]);

		expect(ordered).toEqual(["open", "in-progress", "done", "None"]);
	});

	it("orders priority columns by configured weight when no manual order is saved", () => {
		const view = makeView();
		(view as any).columnOrders = {};
		(view as any).pinnedColumns = [];

		const ordered = (view as any).applyColumnOrder("priority", [
			"low",
			"None",
			"high",
			"normal",
		]);

		expect(ordered).toEqual(["high", "normal", "low", "None"]);
	});

	it("keeps saved manual column order ahead of configured defaults", () => {
		const view = makeView();
		(view as any).columnOrders = {
			status: ["done", "open"],
		};
		(view as any).pinnedColumns = [];

		const ordered = (view as any).applyColumnOrder("status", [
			"open",
			"in-progress",
			"done",
			"None",
		]);

		expect(ordered).toEqual(["done", "open", "in-progress", "None"]);
	});
});
