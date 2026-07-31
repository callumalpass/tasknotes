import { TFile, type App } from "obsidian";
import { FieldMapper } from "../../../src/core/FieldMapper";
import { FilterService } from "../../../src/services/FilterService";
import { PriorityManager } from "../../../src/services/PriorityManager";
import { StatusManager } from "../../../src/services/StatusManager";
import {
	DEFAULT_FIELD_MAPPING,
	DEFAULT_PRIORITIES,
	DEFAULT_SETTINGS,
	DEFAULT_STATUSES,
} from "../../../src/settings/defaults";
import type { FilterQuery, TaskInfo } from "../../../src/types";
import { TaskManager } from "../../../src/utils/TaskManager";

type MockApp = App & {
	__files: Map<string, TFile>;
	__metadata: Map<string, { frontmatter: Record<string, unknown> }>;
	__metadataReads: number;
};

function createMockApp(): MockApp {
	const files = new Map<string, TFile>();
	const metadata = new Map<string, { frontmatter: Record<string, unknown> }>();

	const app = {
		__files: files,
		__metadata: metadata,
		__metadataReads: 0,
		vault: {
			getMarkdownFiles: jest.fn(() => Array.from(files.values())),
			getAbstractFileByPath: jest.fn((path: string) => files.get(path) ?? null),
			on: jest.fn(() => ({})),
		},
		metadataCache: {
			getFileCache: jest.fn((file: TFile) => {
				app.__metadataReads++;
				return metadata.get(file.path) ?? null;
			}),
			on: jest.fn(() => ({})),
			offref: jest.fn(),
		},
	} as unknown as MockApp;

	return app;
}

function createFile(app: MockApp, path: string, frontmatter: Record<string, unknown>): void {
	const file = new TFile(path);
	app.__files.set(path, file);
	app.__metadata.set(path, { frontmatter });
}

function createTaskManager(app: MockApp): TaskManager {
	return new TaskManager(
		app,
		{
			...DEFAULT_SETTINGS,
			taskIdentificationMethod: "tag",
			taskTag: "task",
		},
		new FieldMapper(DEFAULT_FIELD_MAPPING)
	);
}

function createFilterService(taskManager: TaskManager, app: MockApp): FilterService {
	return new FilterService(
		taskManager,
		new StatusManager(DEFAULT_STATUSES, DEFAULT_SETTINGS.defaultTaskStatus),
		new PriorityManager(DEFAULT_PRIORITIES),
		{ app, settings: DEFAULT_SETTINGS }
	);
}

function createTask(path: string, overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: path,
		status: "open",
		priority: "normal",
		path,
		archived: false,
		tags: ["task"],
		contexts: [],
		projects: [],
		...overrides,
	} as TaskInfo;
}

function statusQuery(status: string): FilterQuery {
	return {
		type: "group",
		id: "root",
		conjunction: "and",
		children: [
			{
				type: "condition",
				id: "status",
				property: "status",
				operator: "is",
				value: status,
			},
		],
		sortKey: "due",
		sortDirection: "asc",
		groupKey: "none",
	};
}

describe("filter cache indexing", () => {
	it("returns new filter options immediately after indexed fields change", async () => {
		const app = createMockApp();
		createFile(app, "Tasks/A.md", {
			title: "A",
			status: "open",
			priority: "normal",
			tags: ["task"],
		});

		const taskManager = createTaskManager(app);
		const filterService = createFilterService(taskManager, app);
		filterService.initialize();

		const initialOptions = await filterService.getFilterOptions();
		expect(initialOptions.tags).toEqual(["task"]);

		taskManager.updateTaskInfoInCache(
			"Tasks/A.md",
			createTask("Tasks/A.md", { tags: ["task", "urgent"] })
		);

		const updatedOptions = await filterService.getFilterOptions();
		expect(updatedOptions).not.toBe(initialOptions);
		expect(updatedOptions.tags).toEqual(["task", "urgent"]);
	});

	it("keeps query and option caches when a task update does not change indexed fields", async () => {
		const app = createMockApp();
		createFile(app, "Tasks/A.md", {
			title: "A",
			status: "open",
			priority: "normal",
			tags: ["task"],
		});

		const taskManager = createTaskManager(app);
		const filterService = createFilterService(taskManager, app);
		filterService.initialize();

		const initialOptions = await filterService.getFilterOptions();
		await filterService.getGroupedTasks(statusQuery("open"));
		expect(filterService.getCacheStats().entryCount).toBeGreaterThan(0);

		taskManager.updateTaskInfoInCache(
			"Tasks/A.md",
			createTask("Tasks/A.md", { title: "A renamed", tags: ["task"] })
		);

		expect(filterService.getCacheStats().entryCount).toBeGreaterThan(0);
		expect(await filterService.getFilterOptions()).toBe(initialOptions);
	});

	it("serves date range candidates from the maintained date indexes", () => {
		const app = createMockApp();
		createFile(app, "Tasks/Early.md", {
			title: "Early",
			status: "open",
			tags: ["task"],
			scheduled: "2026-06-01",
		});
		createFile(app, "Tasks/Late.md", {
			title: "Late",
			status: "open",
			tags: ["task"],
			scheduled: "2026-06-20",
		});

		const taskManager = createTaskManager(app);
		taskManager.getAllTaskPaths();
		app.__metadataReads = 0;

		expect(
			Array.from(
				taskManager.getTaskPathsForDateRange("scheduled", "is-before", "2026-06-10")
			)
		).toEqual(["Tasks/Early.md"]);
		expect(app.__metadataReads).toBe(0);
	});
});
