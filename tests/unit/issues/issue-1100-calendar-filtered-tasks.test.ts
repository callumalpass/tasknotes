import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { CalendarView } from "../../../src/bases/CalendarView";
import type { BasesDataItem } from "../../../src/bases/helpers";
import type TaskNotesPlugin from "../../../src/main";
import { DEFAULT_CALENDAR_VIEW_SETTINGS } from "../../../src/settings/defaults";
import type { TaskInfo } from "../../../src/types";

type CalendarViewProbe = {
	render(): Promise<void>;
	calendar: unknown;
	calendarEl: HTMLElement | null;
	rootElement: HTMLElement | null;
	data: { data: Array<{ file?: { path?: string } }> };
	plugin: TaskNotesPlugin;
	config?: unknown;
	configLoaded: boolean;
	enableSearch: boolean;
	basesEntryByPath: Map<string, unknown>;
	dataAdapter: {
		extractDataItems: jest.Mock<() => BasesDataItem[]>;
		getSortConfig: jest.Mock<() => unknown>;
	};
	applySearchFilter: jest.Mock<(tasks: TaskInfo[]) => TaskInfo[]>;
	updateBasesSortIndexes: jest.Mock<(tasks: TaskInfo[]) => void>;
	initializeCalendar: jest.Mock<(tasks: TaskInfo[]) => Promise<void>>;
	updateCalendarEvents: jest.Mock<(tasks: TaskInfo[]) => Promise<void>>;
};

function createTaskItem(path: string, title: string): BasesDataItem {
	return {
		path,
		name: title,
		properties: {
			title,
			status: "open",
			priority: "normal",
			tags: ["task"],
		},
	};
}

function createPlugin(): TaskNotesPlugin {
	return {
		settings: {
			storeTitleInFilename: false,
			defaultTaskStatus: "open",
			calendarViewSettings: { ...DEFAULT_CALENDAR_VIEW_SETTINGS },
		},
		fieldMapper: {
			mapFromFrontmatter: (frontmatter: Record<string, unknown>) => frontmatter,
		},
		cacheManager: {
			isTaskFile: (frontmatter: Record<string, unknown>) =>
				Array.isArray(frontmatter.tags) && frontmatter.tags.includes("task"),
			getCachedTaskInfoSync: jest.fn(() => null),
		},
		dependencyCache: {
			isTaskBlocked: jest.fn(() => false),
			getBlockedTaskPaths: jest.fn(() => []),
		},
		app: {
			metadataCache: {
				getCache: jest.fn(() => null),
			},
		},
	} as unknown as TaskNotesPlugin;
}

function createCalendarViewProbe(calendar: unknown = null): CalendarViewProbe {
	const rootElement = document.createElement("div");
	const calendarEl = document.createElement("div");
	document.body.append(rootElement, calendarEl);

	const allItems = [
		createTaskItem("tasks/project-meeting.md", "Project meeting"),
		createTaskItem("tasks/grocery-list.md", "Grocery list"),
	];
	const view = Object.create(CalendarView.prototype) as CalendarViewProbe;
	view.calendar = calendar;
	view.calendarEl = calendarEl;
	view.rootElement = rootElement;
	(view as any).containerEl = calendarEl;
	view.data = {
		data: allItems.map((item) => ({ file: { path: item.path } })),
	};
	view.plugin = createPlugin();
	view.config = undefined;
	view.configLoaded = true;
	view.enableSearch = false;
	view.basesEntryByPath = new Map();
	view.dataAdapter = {
		extractDataItems: jest.fn(() => allItems),
		getSortConfig: jest.fn(() => []),
	};
	view.applySearchFilter = jest.fn((tasks) =>
		tasks.filter((task) => task.title === "Project meeting")
	);
	view.updateBasesSortIndexes = jest.fn();
	view.initializeCalendar = jest.fn(() => Promise.resolve());
	view.updateCalendarEvents = jest.fn(() => Promise.resolve());

	return view;
}

describe("Issue #1100: Advanced Calendar View filtering", () => {
	afterEach(() => {
		document.body.replaceChildren();
		jest.clearAllMocks();
	});

	it("initializes the calendar with the filtered task set", async () => {
		const view = createCalendarViewProbe();

		await view.render();

		expect(view.initializeCalendar).toHaveBeenCalledWith([
			expect.objectContaining({
				path: "tasks/project-meeting.md",
				title: "Project meeting",
			}),
		]);
		expect(view.initializeCalendar).not.toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					path: "tasks/grocery-list.md",
				}),
			])
		);
		expect(view.updateBasesSortIndexes).toHaveBeenCalledWith([
			expect.objectContaining({ path: "tasks/project-meeting.md" }),
		]);
	});

	it("updates an existing calendar with the filtered task set", async () => {
		const view = createCalendarViewProbe({ refetchEvents: jest.fn() });

		await view.render();

		expect(view.updateCalendarEvents).toHaveBeenCalledWith([
			expect.objectContaining({
				path: "tasks/project-meeting.md",
				title: "Project meeting",
			}),
		]);
		expect(view.updateCalendarEvents).not.toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					path: "tasks/grocery-list.md",
				}),
			])
		);
	});
});
