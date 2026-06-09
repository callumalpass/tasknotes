import type { App } from "obsidian";
import { App as MockApp, MockObsidian, TFile } from "../../helpers/obsidian-runtime";
import type TaskNotesPlugin from "../../../src/main";
import { TaskEditModal } from "../../../src/modals/TaskEditModal";
import { ProjectSubtasksService } from "../../../src/services/ProjectSubtasksService";
import type { TaskInfo } from "../../../src/types";

const createMockApp = (): App => new MockApp() as unknown as App;

const createTask = (overrides: Partial<TaskInfo>): TaskInfo =>
	({
		title: "Task",
		status: "open",
		priority: "normal",
		path: "Tasks/task.md",
		archived: false,
		...overrides,
	}) as TaskInfo;

describe("Issue #1822: edit modal subtask ordering", () => {
	let app: App;
	let plugin: {
		app: App;
		statusManager: { isCompletedStatus: jest.Mock<boolean, [string]> };
		priorityManager: { getPriorityWeight: jest.Mock<number, [string]> };
		projectSubtasksService?: ProjectSubtasksService;
	};

	beforeEach(() => {
		MockObsidian.reset();
		app = createMockApp();

		MockObsidian.createTestFile("Tasks/parent.md", "");
		MockObsidian.createTestFile("Tasks/alpha-completed.md", "");
		MockObsidian.createTestFile("Tasks/beta-normal.md", "");
		MockObsidian.createTestFile("Tasks/zeta-high.md", "");

		const priorityWeights: Record<string, number> = {
			highest: 5,
			high: 4,
			normal: 3,
			low: 2,
			lowest: 1,
			none: 0,
		};

		plugin = {
			app,
			statusManager: {
				isCompletedStatus: jest.fn((status: string) => status === "done"),
			},
			priorityManager: {
				getPriorityWeight: jest.fn((priority: string) => priorityWeights[priority] ?? 0),
			},
		};
	});

	it("uses the existing relationship task sort before rendering selected subtasks", async () => {
		const service = new ProjectSubtasksService(plugin as unknown as TaskNotesPlugin);
		jest.spyOn(service, "getTasksLinkedToProject").mockResolvedValue([
			createTask({
				title: "Alpha completed",
				status: "done",
				priority: "high",
				path: "Tasks/alpha-completed.md",
			}),
			createTask({
				title: "Beta normal",
				status: "open",
				priority: "normal",
				due: "2026-05-02",
				path: "Tasks/beta-normal.md",
			}),
			createTask({
				title: "Zeta high",
				status: "open",
				priority: "high",
				path: "Tasks/zeta-high.md",
			}),
		]);
		plugin.projectSubtasksService = service;

		const modal = new TaskEditModal(app, plugin as unknown as TaskNotesPlugin, {
			task: createTask({
				title: "Parent",
				path: "Tasks/parent.md",
			}),
		});

		await (modal as unknown as { initializeSubtasks: () => Promise<void> }).initializeSubtasks();

		const selectedPaths = (
			modal as unknown as { selectedSubtaskFiles: TFile[] }
		).selectedSubtaskFiles.map((file) => file.path);

		expect(selectedPaths).toEqual([
			"Tasks/zeta-high.md",
			"Tasks/beta-normal.md",
			"Tasks/alpha-completed.md",
		]);
	});
});
