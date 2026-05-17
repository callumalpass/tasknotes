import { App, Menu } from "obsidian";
import { TaskContextMenu } from "../../../src/components/TaskContextMenu";
import { createI18nService } from "../../../src/i18n";
import { extractDependencyUid } from "../../../src/utils/dependencyUtils";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskDependency, TaskInfo } from "../../../src/types";

jest.mock("obsidian");

type MockMenuItem = {
	setTitle?: jest.Mock;
	type?: string;
};

type MockMenu = {
	items: MockMenuItem[];
};

const menuMock = Menu as unknown as jest.Mock;

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		id: "Tasks/2026-01-05-145552 Another test.md",
		path: "Tasks/2026-01-05-145552 Another test.md",
		title: "Another test",
		status: "unknown-status",
		priority: "unknown-priority",
		archived: false,
		tags: [],
		contexts: [],
		projects: [],
		...overrides,
	} as TaskInfo;
}

function createPlugin(): TaskNotesPlugin {
	const app = new App();
	return {
		app,
		i18n: createI18nService(),
		settings: {
			customStatuses: [
				{
					value: "open",
					label: undefined as unknown as string,
					order: 0,
				},
				{
					value: "done",
					label: null as unknown as string,
					order: 1,
				},
			],
			customPriorities: [],
			calendarViewSettings: {
				enableTimeblocking: false,
			},
			useFrontmatterMarkdownLinks: true,
		},
		statusManager: {
			getAllStatuses: jest.fn(() => []),
			getNonCompletionStatuses: jest.fn(() => []),
			isCompletedStatus: jest.fn(() => false),
		},
		priorityManager: {
			getAllPriorities: jest.fn(() => []),
			getPrioritiesByWeight: jest.fn(() => [
				{
					value: "normal",
					label: 123 as unknown as string,
					weight: 0,
				},
				{
					value: undefined as unknown as string,
					label: "Missing value",
					weight: 1,
				},
			]),
		},
		taskService: {
			toggleRecurringTaskSkipped: jest.fn(),
			updateBlockingRelationships: jest.fn(),
		},
		cacheManager: {
			getAllContexts: jest.fn(() => []),
			getAllTasks: jest.fn(() => []),
			getTaskInfo: jest.fn(),
		},
		updateTaskProperty: jest.fn(),
		toggleRecurringTaskComplete: jest.fn(),
		getActiveTimeSession: jest.fn(() => null),
		stopTimeTracking: jest.fn(),
		startTimeTracking: jest.fn(),
		openDueDateModal: jest.fn(),
		openScheduledDateModal: jest.fn(),
		openTimeEntryEditor: jest.fn(),
		toggleTaskArchive: jest.fn(),
		openTaskEditModal: jest.fn(),
		openTaskCreationModal: jest.fn(),
	} as unknown as TaskNotesPlugin;
}

function getAllTitleValues(): unknown[] {
	return menuMock.mock.results.flatMap((result) => {
		const menu = result.value as MockMenu | undefined;
		return (
			menu?.items.flatMap((item) =>
				item.setTitle ? item.setTitle.mock.calls.map(([title]) => title) : []
			) ?? []
		);
	});
}

describe("Issue #1435: context menu titles handle malformed task/settings data", () => {
	beforeEach(() => {
		menuMock.mockClear();
	});

	afterEach(() => {
		menuMock.mockClear();
	});

	it("extracts only string dependency UIDs from legacy or malformed dependency entries", () => {
		expect(extractDependencyUid("[[Some Task]]")).toBe("[[Some Task]]");
		expect(extractDependencyUid({ uid: "[[Other Task]]", reltype: "FINISHTOSTART" })).toBe(
			"[[Other Task]]"
		);
		expect(extractDependencyUid({ uid: 123, reltype: "FINISHTOSTART" })).toBe("");
		expect(extractDependencyUid(null)).toBe("");
		expect(extractDependencyUid(undefined)).toBe("");
	});

	it("does not pass non-string titles to Obsidian Menu.setTitle", () => {
		const malformedBlockedBy = [
			"[[Legacy blocker]]",
			{ uid: undefined, reltype: "FINISHTOSTART" },
			{ uid: 123, reltype: "FINISHTOSTART" },
			{ uid: "[[Valid blocker]]", reltype: "FINISHTOSTART" },
		] as unknown as TaskDependency[];

		new TaskContextMenu({
			task: createTask({ blockedBy: malformedBlockedBy }),
			plugin: createPlugin(),
			targetDate: new Date("2026-01-05T12:00:00"),
		});

		const nonStringTitles = getAllTitleValues().filter((title) => typeof title !== "string");

		expect(nonStringTitles).toEqual([]);
		expect(getAllTitleValues()).toEqual(
			expect.arrayContaining(["open", "done", "123", "Unknown", "[[Valid blocker]]"])
		);
	});
});
