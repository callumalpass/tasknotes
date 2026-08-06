import { TaskService } from "../../../src/services/TaskService";
import { PluginFactory } from "../../helpers/mock-factories";
import { MockObsidian } from "../../helpers/obsidian-runtime";

jest.mock("../../../src/utils/dateUtils", () => {
	const actual = jest.requireActual("../../../src/utils/dateUtils");
	return {
		...actual,
		getCurrentTimestamp: jest.fn(() => "2026-06-30T02:00:00+10:00"),
		getCurrentDateString: jest.fn(() => "2026-06-30"),
	};
});

jest.mock("../../../src/utils/filenameGenerator", () => ({
	generateTaskFilename: jest.fn((context) =>
		context.title.toLowerCase().replace(/\s+/g, "-")
	),
	generateUniqueFilename: jest.fn((base) => base),
}));

jest.mock("../../../src/utils/helpers", () => ({
	ensureFolderExists: jest.fn().mockResolvedValue(undefined),
	calculateDefaultDateTime: jest.fn(),
}));

jest.mock("../../../src/utils/templateProcessor", () => ({
	processTemplate: jest.fn(() => ({ frontmatter: {}, body: "" })),
	mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template })),
}));

function createTaskService(): { taskService: TaskService; plugin: ReturnType<typeof PluginFactory.createMockPlugin> } {
	MockObsidian.reset();
	const plugin = PluginFactory.createMockPlugin({
		statusManager: {
			isCompletedStatus: jest.fn((status: string) => status === "done"),
			getCompletedStatuses: jest.fn(() => ["done"]),
		},
		cacheManager: {
			updateTaskInfoInCache: jest.fn(),
			getTaskInfo: jest.fn(),
		},
	});
	plugin.app.workspace.getActiveFile = jest.fn().mockReturnValue(null);

	return { taskService: new TaskService(plugin), plugin };
}

describe("Issue #2092: completedDate on completed task creation", () => {
	it("sets completedDate when a non-recurring task is created with a completed status", async () => {
		const { taskService, plugin } = createTaskService();

		const { taskInfo } = await taskService.createTask({
			title: "Test event",
			status: "done",
			priority: "normal",
			scheduled: "2026-06-30",
		});

		expect(taskInfo.completedDate).toBe("2026-06-30");
		expect(plugin.app.vault.create).toHaveBeenCalledWith(
			"Tasks/test-event.md",
			expect.stringContaining("completedDate: 2026-06-30")
		);
	});

	it("does not set completedDate when a recurring task is created with a completed status", async () => {
		const { taskService, plugin } = createTaskService();

		const { taskInfo } = await taskService.createTask({
			title: "Recurring event",
			status: "done",
			priority: "normal",
			scheduled: "2026-06-30",
			recurrence: "FREQ=DAILY",
		});

		expect(taskInfo.completedDate).toBeUndefined();
		expect(plugin.app.vault.create).toHaveBeenCalledWith(
			"Tasks/recurring-event.md",
			expect.not.stringContaining("completedDate:")
		);
	});
});
