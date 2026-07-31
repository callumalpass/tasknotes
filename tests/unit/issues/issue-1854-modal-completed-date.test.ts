import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";
import { MockObsidian, TFile } from "../../helpers/obsidian-runtime";
import { TaskService } from "../../../src/services/TaskService";
import { buildTaskEditChanges } from "../../../src/modals/taskEditChanges";

jest.mock("../../../src/utils/dateUtils", () => {
	const actual = jest.requireActual("../../../src/utils/dateUtils");
	return {
		...actual,
		getCurrentTimestamp: jest.fn(() => "2026-05-14T10:00:00Z"),
		getCurrentDateString: jest.fn(() => "2026-05-14"),
	};
});

describe("Issue #1854: completing via edit modal writes completedDate", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		MockObsidian.reset();
	});

	it("applies completedDate when edit modal changes a non-recurring task to a completed status", async () => {
		const plugin = PluginFactory.createMockPlugin({
			statusManager: {
				isCompletedStatus: jest.fn((status) => status === "done"),
				getCompletedStatuses: jest.fn(() => ["done"]),
			},
			cacheManager: {
				updateTaskInfoInCache: jest.fn(),
				getTaskInfo: jest.fn(),
				clearCacheEntry: jest.fn(),
				waitForFreshTaskData: jest.fn().mockResolvedValue(undefined),
			},
		});
		plugin.taskCalendarSyncService = {
			isEnabled: jest.fn().mockReturnValue(false),
			updateTaskInCalendar: jest.fn().mockResolvedValue(undefined),
			completeTaskInCalendar: jest.fn().mockResolvedValue(undefined),
		};

		const task = TaskFactory.createTask({
			path: "Tasks/modal-complete.md",
			title: "Modal complete",
			status: "open",
			completedDate: undefined,
		});
		const file = new TFile(task.path);
		plugin.app.vault.getAbstractFileByPath.mockReturnValue(file);

		const editResult = buildTaskEditChanges({
			task,
			title: task.title,
			dueDate: task.due || "",
			scheduledDate: task.scheduled || "",
			priority: task.priority,
			status: "done",
			contexts: "",
			projects: "",
			tags: "task",
			initialTags: "task",
			timeEstimate: task.timeEstimate || 0,
			recurrenceRule: "",
			recurrenceAnchor: "scheduled",
			reminders: [],
			blockedByItems: [],
			initialBlockedBy: [],
			blockingItems: [],
			initialBlockingPaths: [],
			details: "",
			originalDetails: "",
			completedInstancesChanges: [],
			skippedInstancesChanges: [],
			userFields: {},
			frontmatter: {},
			userFieldConfigs: [],
			taskIdentificationMethod: "tag",
			taskTag: "task",
			maintainDueDateOffsetInRecurring: false,
			normalizeDetails: (value) => value,
		});

		const taskService = new TaskService(plugin);
		const updatedTask = await taskService.updateTask(task, editResult.changes);

		expect(editResult.changes.status).toBe("done");
		expect(updatedTask.completedDate).toBe("2026-05-14");
	});
});
