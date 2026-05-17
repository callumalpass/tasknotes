import { TaskEditModal } from "../../../src/modals/TaskEditModal";
import { MockObsidian } from "../../__mocks__/obsidian";
import type { App } from "obsidian";
import type { TaskInfo } from "../../../src/types";

jest.mock("obsidian");

const createMockApp = (mockApp: unknown): App => mockApp as App;

describe("Issue #1469: convert current note to task save", () => {
	let app: App;
	let plugin: any;
	let task: TaskInfo;
	let onTaskUpdated: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		MockObsidian.reset();

		app = createMockApp(MockObsidian.createMockApp());
		onTaskUpdated = jest.fn();
		task = {
			title: "Plain note",
			status: "in-progress",
			priority: "high",
			path: "plain-note.md",
			archived: false,
			tags: [],
			contexts: [],
			projects: [],
			dateCreated: "2026-01-12T18:00:00.000+00:00",
			dateModified: "2026-01-12T18:00:00.000+00:00",
			details: "Existing note body",
		};

		plugin = {
			app,
			settings: {
				taskTag: "task",
				taskIdentificationMethod: "tag",
				defaultTaskPriority: "high",
				defaultTaskStatus: "in-progress",
				maintainDueDateOffsetInRecurring: false,
				useFrontmatterMarkdownLinks: false,
				modalFieldsConfig: {},
				userFields: [],
			},
			taskService: {
				updateTask: jest.fn(async (originalTask: TaskInfo, changes: Partial<TaskInfo>) => ({
					...originalTask,
					...changes,
				})),
			},
			statusManager: {
				isCompletedStatus: jest.fn(() => false),
				getStatusConfig: jest.fn(() => undefined),
			},
			cacheManager: {
				getTaskInfo: jest.fn(),
			},
			i18n: {
				translate: jest.fn((key: string) => key),
			},
		};
	});

	function createInitializedModal() {
		const modal = new TaskEditModal(app, plugin, { task, onTaskUpdated });
		(modal as any).task = task;
		(modal as any).title = task.title;
		(modal as any).status = task.status;
		(modal as any).priority = task.priority;
		(modal as any).dueDate = "";
		(modal as any).scheduledDate = "";
		(modal as any).contexts = "";
		(modal as any).projects = "";
		(modal as any).tags = "";
		(modal as any).initialTags = "";
		(modal as any).timeEstimate = 0;
		(modal as any).recurrenceRule = "";
		(modal as any).recurrenceAnchor = "scheduled";
		(modal as any).reminders = [];
		(modal as any).details = task.details;
		(modal as any).originalDetails = task.details;
		(modal as any).userFields = {};
		(modal as any).isConvertingNoteToTask = true;
		return modal;
	}

	it("does not mark an untouched conversion modal dirty when closing", () => {
		const modal = createInitializedModal();

		expect((modal as any).getChanges()).toEqual({});
	});

	it("writes the task frontmatter when saving an untouched converted note", async () => {
		const modal = createInitializedModal();

		await modal.handleSave();

		expect(plugin.taskService.updateTask).toHaveBeenCalledWith(
			task,
			expect.objectContaining({
				dateModified: expect.any(String),
			})
		);
		expect(onTaskUpdated).toHaveBeenCalledWith(
			expect.objectContaining({
				title: task.title,
				status: task.status,
				priority: task.priority,
			})
		);
	});
});
