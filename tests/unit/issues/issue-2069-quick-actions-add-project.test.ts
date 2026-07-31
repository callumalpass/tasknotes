import { App, TFile } from "obsidian";
import { TaskActionPaletteModal } from "../../../src/modals/TaskActionPaletteModal";
import { ProjectSelectModal } from "../../../src/modals/ProjectSelectModal";
import { addTaskToProject } from "../../../src/services/taskRelationshipActions";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

const mockProjectSelectModalOpen = jest.fn();
const mockProjectSelectModalCallbacks: Array<(file: TFile) => void> = [];

jest.mock("../../../src/modals/ProjectSelectModal", () => ({
	ProjectSelectModal: jest.fn().mockImplementation((_app, _plugin, onChoose) => {
		mockProjectSelectModalCallbacks.push(onChoose);
		return {
			open: mockProjectSelectModalOpen,
		};
	}),
}));

jest.mock("../../../src/services/taskRelationshipActions", () => ({
	addTaskToProject: jest.fn(),
}));

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		id: "Tasks/quick-actions-project.md",
		path: "Tasks/quick-actions-project.md",
		title: "Quick Actions project task",
		status: "open",
		priority: "normal",
		projects: [],
		...overrides,
	} as TaskInfo;
}

function createPlugin(): TaskNotesPlugin {
	const app = new App();
	return {
		app,
		i18n: {
			translate: jest.fn((key: string) => key),
		},
		statusManager: {
			getAllStatuses: jest.fn(() => [{ value: "open", label: "Open" }]),
			getNonCompletionStatuses: jest.fn(() => [{ value: "open", label: "Open" }]),
		},
		priorityManager: {
			getAllPriorities: jest.fn(() => [{ value: "normal", label: "Normal" }]),
		},
		cacheManager: {
			getTaskInfo: jest.fn(),
		},
		updateTaskProperty: jest.fn(),
		getActiveTimeSession: jest.fn(() => null),
		stopTimeTracking: jest.fn(),
		startTimeTracking: jest.fn(),
		openDueDateModal: jest.fn(),
		openScheduledDateModal: jest.fn(),
		openTimeEntryEditor: jest.fn(),
		toggleTaskArchive: jest.fn(),
		openTaskEditModal: jest.fn(),
	} as unknown as TaskNotesPlugin;
}

function createModal(task: TaskInfo, plugin: TaskNotesPlugin): TaskActionPaletteModal {
	return new TaskActionPaletteModal(
		new App() as never,
		task,
		plugin,
		new Date("2026-06-23T10:00:00Z")
	);
}

describe("Issue #2069: Quick Actions add project action", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockProjectSelectModalCallbacks.length = 0;
	});

	it("exposes Add project as an organization action", () => {
		const modal = createModal(createTask(), createPlugin());

		const action = modal.getItems().find((item) => item.id === "add-project");

		expect(action).toEqual(
			expect.objectContaining({
				title: "Add project",
				category: "organization",
				icon: "folder-plus",
			})
		);
	});

	it("opens the project selector and adds the chosen project through the shared helper", async () => {
		const task = createTask();
		const plugin = createPlugin();
		const projectFile = new TFile("Projects/Alpha.md");
		const modal = createModal(task, plugin);
		const closeSpy = jest.spyOn(modal, "close");
		const action = modal.getItems().find((item) => item.id === "add-project");

		await action?.execute(task, plugin, new Date("2026-06-23T10:00:00Z"));
		mockProjectSelectModalCallbacks[0](projectFile);

		expect(ProjectSelectModal).toHaveBeenCalledWith(plugin.app, plugin, expect.any(Function));
		expect(closeSpy).toHaveBeenCalledTimes(1);
		expect(mockProjectSelectModalOpen).toHaveBeenCalledTimes(1);
		expect(closeSpy.mock.invocationCallOrder[0]).toBeLessThan(
			mockProjectSelectModalOpen.mock.invocationCallOrder[0]
		);
		expect(addTaskToProject).toHaveBeenCalledWith(plugin, task, projectFile);
	});
});
