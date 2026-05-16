jest.mock("../../../src/modals/TaskCreationModal", () => ({
	TaskCreationModal: jest.fn().mockImplementation(
		(_app: unknown, _plugin: unknown, options: unknown) => ({
			open: jest.fn(),
			options,
		})
	),
}));

import { KanbanView } from "../../../src/bases/KanbanView";
import { TaskCreationModal } from "../../../src/modals/TaskCreationModal";

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
	const userFields = [{ id: "workstream", key: "workstream", displayName: "Workstream", type: "text" }];
	const recognized = new Set([...Object.values(fieldMapping), ...userFields.map((field) => field.key)]);

	return {
		app: {
			metadataCache: {},
			workspace: {},
		},
		fieldMapper: {
			toUserField: (field: keyof typeof fieldMapping) => fieldMapping[field] ?? field,
			getMapping: () => fieldMapping,
			isRecognizedProperty: (property: string) => recognized.has(property),
		},
		i18n: {
			translate: (key: string) => key,
		},
		settings: {
			taskTag: "task",
			userFields,
			fieldMapping,
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

function createView() {
	return new KanbanView(
		{
			viewName: "Board",
			query: {
				views: [{ name: "Board", groupBy: { property: "task.status" } }],
			},
		},
		document.createElement("div"),
		createPlugin() as any
	);
}

describe("Issue #1471: create tasks from Kanban columns", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("opens the TaskNotes creation modal with view filter and column defaults", async () => {
		const view = createView();
		(view as any).config = {
			filters: {
				conjunction: "and",
				filters: [
					{ rule: { text: 'file.hasTag("task")' } },
					{ rule: { text: 'projects.contains("[[Project Alpha]]")' } },
				],
			},
		};

		await (view as any).openTaskCreationForKanbanCell("task.status", "done");

		expect(TaskCreationModal).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({
				prePopulatedValues: expect.objectContaining({
					status: "done",
					projects: ["[[Project Alpha]]"],
				}),
			})
		);
	});

	it("uses both column and swimlane values when creating from a swimlane cell", async () => {
		const view = createView();
		(view as any).config = {};
		(view as any).swimLanePropertyId = "task.priority";

		await (view as any).openTaskCreationForKanbanCell("task.status", "in-progress", "high");

		expect(TaskCreationModal).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({
				prePopulatedValues: expect.objectContaining({
					status: "in-progress",
					priority: "high",
				}),
			})
		);
	});

	it("passes custom grouped properties through custom frontmatter", async () => {
		const view = createView();
		(view as any).config = {};

		await (view as any).openTaskCreationForKanbanCell("note.workstream", "Research");

		expect(TaskCreationModal).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({
				prePopulatedValues: expect.objectContaining({
					customFrontmatter: {
						workstream: "Research",
					},
				}),
			})
		);
	});
});
