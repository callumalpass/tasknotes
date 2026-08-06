import { TaskEditModal } from "../../../src/modals/TaskEditModal";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import type { App } from "obsidian";
import type { TaskInfo } from "../../../src/types";

function createMockApp(mockApp: unknown): App {
	return mockApp as App;
}

function translate(key: string, params?: Record<string, string | number>): string {
	const translations: Record<string, string> = {
		"modals.task.actions.recurrence": "Recurrence",
		"modals.task.actions.reminders": "Reminders",
		"modals.task.contextsLabel": "Contexts",
		"modals.task.contextsPlaceholder": "context1, context2",
		"modals.task.tagsLabel": "Tags",
		"modals.task.tagsPlaceholder": "tag1, tag2",
		"modals.task.chips.timeEstimate": "Time estimate",
		"modals.task.timeEstimatePlaceholder": "30",
		"modals.task.chips.timeEstimateValue": "{minutes}m",
		"modals.task.organization.projects": "Projects",
		"modals.task.organization.subtasks": "Subtasks",
	};
	const template = translations[key] || key;
	return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
		params?.[name] !== undefined ? String(params[name]) : `{${name}}`
	);
}

function createMockPlugin(app: App) {
	return {
		app,
		i18n: {
			translate: jest.fn(translate),
		},
		settings: {
			enableModalSplitLayout: false,
			taskTag: "task",
			taskIdentificationMethod: "tag",
			hideIdentifyingTagsMode: "exact",
			defaultTaskStatus: "open",
			userFields: [],
			customStatuses: [],
			customPriorities: [],
		},
		cacheManager: {
			getTaskInfo: jest.fn(),
			getCachedTaskInfoSync: jest.fn(),
			isTaskFile: jest.fn(() => true),
		},
		fieldMapper: {
			toUserField: jest.fn((key: string) => key),
		},
	};
}

function createTask(): TaskInfo {
	return {
		title: "Some task",
		status: "open",
		priority: "normal",
		path: "TaskNotes/Tasks/some-task.md",
		archived: false,
		tags: ["task"],
		contexts: [],
		projects: [],
	} as TaskInfo;
}

describe("Task modal sidebar rows: without a value", () => {
	let app: App;
	let plugin: ReturnType<typeof createMockPlugin>;
	let modal: TaskEditModal;

	beforeEach(() => {
		MockObsidian.reset();
		app = createMockApp(MockObsidian.createMockApp());
		plugin = createMockPlugin(app);
		modal = new TaskEditModal(app, plugin as any, { task: createTask() });
	});

	it("leaves the due date row's value blank instead of showing an add-date placeholder", () => {
		(modal as any).dueDate = "";

		const row = (modal as any).buildPropertyRowSpec("due-date");

		expect(row.value).toBe("");
		expect(row.hasValue).toBe(false);
	});

	it("leaves the scheduled date row's value blank instead of showing an add-date placeholder", () => {
		(modal as any).scheduledDate = "";

		const row = (modal as any).buildPropertyRowSpec("scheduled-date");

		expect(row.value).toBe("");
		expect(row.hasValue).toBe(false);
	});

	it("leaves the recurrence row's value blank instead of repeating its own label", () => {
		(modal as any).recurrenceRule = "";

		const row = (modal as any).buildPropertyRowSpec("recurrence");

		expect(row.label).toBe("Recurrence");
		expect(row.value).toBe("");
		expect(row.hasValue).toBe(false);
	});

	it("leaves the reminders row's value blank instead of repeating its own label", () => {
		(modal as any).reminders = [];

		const row = (modal as any).buildPropertyRowSpec("reminders");

		expect(row.label).toBe("Reminders");
		expect(row.value).toBe("");
		expect(row.hasValue).toBe(false);
	});

	it("still shows a real value once recurrence/reminders are set", () => {
		(modal as any).recurrenceRule = "FREQ=DAILY";
		(modal as any).reminders = [{ id: "1" }];

		const recurrenceRow = (modal as any).buildPropertyRowSpec("recurrence");
		const remindersRow = (modal as any).buildPropertyRowSpec("reminders");

		expect(recurrenceRow.value).not.toBe("");
		expect(recurrenceRow.hasValue).toBe(true);
		expect(remindersRow.value).toBe("1");
		expect(remindersRow.hasValue).toBe(true);
	});

	it("leaves the contexts row's value blank instead of showing the example placeholder", () => {
		(modal as any).contexts = "";

		const row = (modal as any).buildPropertyRowSpec("contexts");

		expect(row.label).toBe("Contexts");
		expect(row.value).toBe("");
		expect(row.hasValue).toBe(false);
	});

	it("leaves the tags row's value blank instead of showing the example placeholder", () => {
		(modal as any).tags = "";

		const row = (modal as any).buildPropertyRowSpec("tags");

		expect(row.label).toBe("Tags");
		expect(row.value).toBe("");
		expect(row.hasValue).toBe(false);
	});

	it("leaves the time estimate row's value blank instead of showing the example placeholder", () => {
		(modal as any).timeEstimate = 0;

		const row = (modal as any).buildPropertyRowSpec("time-estimate");

		expect(row.label).toBe("Time estimate");
		expect(row.value).toBe("");
		expect(row.hasValue).toBe(false);
	});

	it("leaves the projects row's value blank instead of showing the add placeholder", () => {
		(modal as any).selectedProjectItems = [];

		expect((modal as any).getSidebarProjectsValue()).toBe("");
	});

	it("leaves the subtasks row's value blank instead of showing the add placeholder", () => {
		(modal as any).selectedSubtaskFiles = [];

		expect((modal as any).getSidebarSubtasksValue()).toBe("");
	});

	it("still shows real values once projects/subtasks are set", () => {
		(modal as any).selectedProjectItems = [{ name: "Work", link: "Work" }];
		(modal as any).selectedSubtaskFiles = [
			{ name: "My subtask", path: "TaskNotes/Tasks/subtask.md" },
		];

		expect((modal as any).getSidebarProjectsValue()).toBe("Work");
		expect((modal as any).getSidebarSubtasksValue()).toBe("My subtask");
	});

	it("still shows real values once contexts/tags/time estimate are set", () => {
		(modal as any).contexts = "home, work";
		(modal as any).tags = "urgent";
		(modal as any).timeEstimate = 30;

		const contextsRow = (modal as any).buildPropertyRowSpec("contexts");
		const tagsRow = (modal as any).buildPropertyRowSpec("tags");
		const timeEstimateRow = (modal as any).buildPropertyRowSpec("time-estimate");

		expect(contextsRow.value).toBe("home, work");
		expect(contextsRow.hasValue).toBe(true);
		expect(tagsRow.value).toBe("urgent");
		expect(tagsRow.hasValue).toBe(true);
		expect(timeEstimateRow.value).toBe("30m");
		expect(timeEstimateRow.hasValue).toBe(true);
	});
});
