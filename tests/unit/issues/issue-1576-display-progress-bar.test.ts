import { createTaskCard, updateTaskCard } from "../../../src/ui/TaskCard";
import { TaskFactory } from "../../helpers/mock-factories";
import { App, MockObsidian } from "../../__mocks__/obsidian";

jest.mock("obsidian");

jest.mock("../../../src/utils/helpers", () => ({
	calculateTotalTimeSpent: jest.fn(() => 0),
	getEffectiveTaskStatus: jest.fn((task) => task.status || "open"),
	shouldUseRecurringTaskUI: jest.fn(() => false),
	getRecurringTaskCompletionText: jest.fn(() => "Not completed for this date"),
	getRecurrenceDisplayText: jest.fn(() => "Daily"),
	filterEmptyProjects: jest.fn((projects) => projects?.filter((p: string) => p && p.trim()) || []),
}));

jest.mock("../../../src/utils/dateUtils", () => ({
	isTodayTimeAware: jest.fn(() => false),
	isOverdueTimeAware: jest.fn(() => false),
	formatDateTimeForDisplay: jest.fn(() => "Jan 15"),
	getDatePart: jest.fn(() => ""),
	getTimePart: jest.fn(() => null),
	formatDateForStorage: jest.fn((value: Date | string) => {
		if (value instanceof Date) {
			return value.toISOString().split("T")[0];
		}
		return value?.split("T")[0] || "";
	}),
}));

jest.mock("../../../src/components/TaskContextMenu", () => ({
	TaskContextMenu: jest.fn().mockImplementation(() => ({
		show: jest.fn(),
	})),
}));

describe("Issue #1576 - Display Progress Bar on task cards", () => {
	let app: App;
	let plugin: any;

	beforeEach(() => {
		jest.clearAllMocks();
		MockObsidian.reset();

		app = new App();
		plugin = {
			app,
			fieldMapper: {
				lookupMappingKey: jest.fn((propertyId: string) => {
					const mapped = new Set(["status", "priority", "due", "scheduled", "contexts", "projects"]);
					return mapped.has(propertyId) ? propertyId : null;
				}),
				isPropertyForField: jest.fn((propertyId: string, field: string) => propertyId === field),
				toUserField: jest.fn((field: string) => field),
				getMapping: jest.fn(() => ({
					status: "status",
					priority: "priority",
					due: "due",
					scheduled: "scheduled",
					contexts: "contexts",
					projects: "projects",
				})),
			},
			statusManager: {
				isCompletedStatus: jest.fn((status: string) => status === "done"),
				getStatusConfig: jest.fn((status: string) => ({
					value: status,
					label: status,
					color: "#666666",
				})),
				getNextStatus: jest.fn(() => "done"),
				getCompletedStatuses: jest.fn(() => ["done"]),
			},
			priorityManager: {
				getPriorityConfig: jest.fn((priority: string) => ({
					value: priority,
					label: priority,
					color: "#ff0000",
				})),
			},
			getActiveTimeSession: jest.fn(() => null),
			cacheManager: {
				getTaskInfo: jest.fn(),
			},
			updateTaskProperty: jest.fn(),
			getTaskByPath: jest.fn(),
			projectSubtasksService: {
				isTaskUsedAsProject: jest.fn().mockResolvedValue(false),
				isTaskUsedAsProjectSync: jest.fn().mockReturnValue(false),
			},
			i18n: {
				translate: jest.fn((key: string) => key),
			},
			settings: {
				singleClickAction: "edit",
				doubleClickAction: "none",
				showExpandableSubtasks: true,
				subtaskChevronPosition: "right",
				hideCompletedFromOverdue: true,
				calendarViewSettings: {
					timeFormat: "24",
				},
			},
		};

		jest.spyOn(console, "error").mockImplementation(() => {});
		jest.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	function listItem(taskChar: string, parent: number, line: number) {
		return {
			task: taskChar,
			parent,
			position: {
				start: { line, col: 0, offset: 0 },
				end: { line, col: 10, offset: 10 },
			},
		};
	}

	it("renders checklist progress and ignores nested checkboxes", () => {
		const task = TaskFactory.createTask({
			path: "tasks/progress-task.md",
			title: "Checklist task",
		});

		MockObsidian.createTestFile(task.path, "# Checklist task");
		app.metadataCache.setCache(task.path, {
			frontmatter: { title: task.title },
			listItems: [
				listItem("x", -1, 10), // top-level complete
				listItem(" ", -1, 11), // top-level incomplete
				listItem("x", 10, 12), // nested complete (ignored)
				listItem(" ", 11, 13), // nested incomplete (ignored)
			],
		});

		const card = createTaskCard(task, plugin, ["checklistProgress"]);

		const progressEl = card.querySelector(".task-card__progress");
		expect(progressEl).not.toBeNull();
		expect(card.querySelector(".task-card__progress-label")?.textContent).toBe("1/2");
		expect((card.querySelector(".task-card__progress-fill") as HTMLElement).style.width).toBe("50%");
	});

	it("does not render checklist progress when only nested checkboxes exist", () => {
		const task = TaskFactory.createTask({
			path: "tasks/nested-only-task.md",
			title: "Nested only",
		});

		MockObsidian.createTestFile(task.path, "# Nested only");
		app.metadataCache.setCache(task.path, {
			frontmatter: { title: task.title },
			listItems: [
				listItem("x", 5, 10),
				listItem(" ", 5, 11),
			],
		});

		const card = createTaskCard(task, plugin, ["checklistProgress"]);

		expect(card.querySelector(".task-card__progress")).toBeNull();
		const metadata = card.querySelector(".task-card__metadata") as HTMLElement;
		expect(metadata.style.display).toBe("none");
	});

	it("updates checklist progress after metadata cache changes", () => {
		const task = TaskFactory.createTask({
			path: "tasks/update-progress-task.md",
			title: "Update progress",
		});

		MockObsidian.createTestFile(task.path, "# Update progress");
		app.metadataCache.setCache(task.path, {
			frontmatter: { title: task.title },
			listItems: [
				listItem("x", -1, 10),
				listItem(" ", -1, 11),
			],
		});

		const card = createTaskCard(task, plugin, ["checklistProgress"]);
		expect(card.querySelector(".task-card__progress-label")?.textContent).toBe("1/2");

		app.metadataCache.setCache(task.path, {
			frontmatter: { title: task.title },
			listItems: [
				listItem("x", -1, 10),
				listItem("x", -1, 11),
			],
		});

		updateTaskCard(card, task, plugin, ["checklistProgress"]);

		expect(card.querySelector(".task-card__progress-label")?.textContent).toBe("2/2");
		expect((card.querySelector(".task-card__progress-fill") as HTMLElement).style.width).toBe("100%");
	});

	it("treats non-x task markers as incomplete", () => {
		const task = TaskFactory.createTask({
			path: "tasks/custom-marker-task.md",
			title: "Custom marker",
		});

		MockObsidian.createTestFile(task.path, "# Custom marker");
		app.metadataCache.setCache(task.path, {
			frontmatter: { title: task.title },
			listItems: [
				listItem("-", -1, 10), // not completed
				listItem("x", -1, 11), // completed
			],
		});

		const card = createTaskCard(task, plugin, ["checklistProgress"]);
		expect(card.querySelector(".task-card__progress-label")?.textContent).toBe("1/2");
		expect((card.querySelector(".task-card__progress-fill") as HTMLElement).style.width).toBe("50%");
	});
});
