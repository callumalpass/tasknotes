import { observeTranslation as mockObserveTranslation, englishText as mockEnglishText, conceptDescriptor as mockConceptDescriptor } from "../../helpers/real-i18n";
import { TaskEditModal } from "../../../src/modals/TaskEditModal";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import type { App } from "obsidian";
import type { TaskInfo } from "../../../src/types";

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
				translate: mockObserveTranslation(),
			},
		};
	});

	function createInitializedModal() {
		const modal = new TaskEditModal(app, plugin, { task, onTaskUpdated });
		(modal as any).task = task;
		(modal as any).form.values.title = task.title;
		(modal as any).form.values.status = task.status;
		(modal as any).form.values.priority = task.priority;
		(modal as any).form.values.dueDate = "";
		(modal as any).form.values.scheduledDate = "";
		(modal as any).form.values.contexts = "";
		(modal as any).form.values.projects = "";
		(modal as any).form.values.tags = "";
		(modal as any).initialTags = "";
		(modal as any).form.values.timeEstimate = 0;
		(modal as any).form.values.recurrenceRule = "";
		(modal as any).form.values.recurrenceAnchor = "scheduled";
		(modal as any).form.values.reminders = [];
		(modal as any).form.values.details = task.details;
		(modal as any).originalDetails = task.details;
		(modal as any).form.values.userFields = {};
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
