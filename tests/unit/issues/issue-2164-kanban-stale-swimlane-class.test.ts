import { KanbanView } from "../../../src/bases/KanbanView";

const fieldMapping = {
	title: "title",
	status: "status",
	priority: "priority",
	due: "due",
	scheduled: "scheduled",
	contexts: "contexts",
	projects: "projects",
	timeEstimate: "timeEstimate",
	completedDate: "completedDate",
	dateCreated: "dateCreated",
	dateModified: "dateModified",
	recurrence: "recurrence",
	recurrenceAnchor: "recurrence_anchor",
	archiveTag: "archived",
	timeEntries: "timeEntries",
	completeInstances: "complete_instances",
	skippedInstances: "skipped_instances",
	blockedBy: "blockedBy",
	pomodoros: "pomodoros",
	icsEventId: "icsEventId",
	icsEventTag: "icsEventTag",
	googleCalendarEventId: "googleCalendarEventId",
	reminders: "reminders",
	sortOrder: "sort_order",
};

function createPlugin() {
	return {
		app: {
			metadataCache: {},
			workspace: {},
		},
		fieldMapper: {
			toUserField: (field: keyof typeof fieldMapping) => fieldMapping[field] ?? field,
			getMapping: () => fieldMapping,
			isRecognizedProperty: (property: string) => Object.values(fieldMapping).includes(property),
		},
		i18n: {
			translate: (key: string) => key,
		},
		settings: {
			taskTag: "task",
			userFields: [],
			fieldMapping,
			defaultVisibleProperties: ["status"],
		},
		statusManager: {
			getStatusConfig: () => undefined,
			getAllStatuses: () => [],
		},
		priorityManager: {
			getPriorityConfig: () => undefined,
			getAllPriorities: () => [],
			getPriorityWeight: () => 0,
		},
	};
}

describe("issue #2164 Kanban stale swimlane class", () => {
	it("clears swimlane board mode before rendering a flat board", async () => {
		const view = new KanbanView(
			{
				viewName: "Board",
				query: {
					views: [{ name: "Board", groupBy: { property: "task.status" } }],
				},
			},
			document.createElement("div"),
			createPlugin() as any
		);
		const board = document.createElement("div");
		board.className = "kanban-view__board kanban-view__board--swimlanes";
		(view as any).boardEl = board;
		(view as any).rootElement = document.createElement("div");
		(view as any).config = {
			getOrder: () => ["task.status"],
			getDisplayName: () => undefined,
		};

		await (view as any).renderFlat(new Map(), new Map());

		expect(board.classList.contains("kanban-view__board--swimlanes")).toBe(false);
	});
});
