import { TFile, type App } from "obsidian";
import { FieldMapper } from "../../src/core/FieldMapper";
import { PriorityManager } from "../../src/services/PriorityManager";
import { StatusManager } from "../../src/services/StatusManager";
import { FilterService } from "../../src/services/FilterService";
import {
	DEFAULT_FIELD_MAPPING,
	DEFAULT_PRIORITIES,
	DEFAULT_SETTINGS,
	DEFAULT_STATUSES,
} from "../../src/settings/defaults";
import type { FilterQuery } from "../../src/types";
import { TaskManager } from "../../src/utils/TaskManager";

type MockApp = App & {
	__files: Map<string, TFile>;
	__metadata: Map<string, { frontmatter: Record<string, unknown> }>;
	__metadataReads: number;
};

interface LargeFilterFixture {
	app: MockApp;
	taskManager: TaskManager;
	filterService: FilterService;
	allTaskPaths: string[];
}

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

function createLargeFilterFixture(taskCount = 8000): LargeFilterFixture {
	const app = createMockApp();
	const allTaskPaths: string[] = [];
	const statuses = ["open", "in-progress", "done", "none"];
	const priorities = ["low", "normal", "high", "none"];

	for (let i = 0; i < taskCount; i++) {
		const path = `Tasks/Area-${i % 40}/Task-${i}.md`;
		allTaskPaths.push(path);
		createFile(app, path, {
			title: `Task ${i}`,
			status: statuses[i % statuses.length],
			priority: priorities[i % priorities.length],
			tags: ["task", `tag-${i % 100}`],
			contexts: [`context-${i % 50}`],
			projects: [`[[Projects/Project-${i % 80}.md]]`],
			due: `2026-06-${String((i % 28) + 1).padStart(2, "0")}`,
			scheduled: `2026-07-${String((i % 28) + 1).padStart(2, "0")}`,
		});
	}

	for (let i = 0; i < 500; i++) {
		createFile(app, `Notes/Reference-${i}.md`, {
			title: `Reference ${i}`,
			tags: ["note"],
		});
	}

	const settings = {
		...DEFAULT_SETTINGS,
		taskIdentificationMethod: "tag",
		taskTag: "task",
	};
	const taskManager = new TaskManager(app, settings, new FieldMapper(DEFAULT_FIELD_MAPPING));
	const statusManager = new StatusManager(DEFAULT_STATUSES, DEFAULT_SETTINGS.defaultTaskStatus);
	const priorityManager = new PriorityManager(DEFAULT_PRIORITIES);
	const filterService = new FilterService(taskManager, statusManager, priorityManager, {
		app,
		settings,
	});
	filterService.initialize();

	return { app, taskManager, filterService, allTaskPaths };
}

function logMetric(label: string, metric: Record<string, number>): void {
	if (process.env.TN_PERF_LOG === "1") {
		process.stderr.write(`[filter-cache-perf] ${label} ${JSON.stringify(metric)}\n`);
	}
}

function queryWithConditions(children: FilterQuery["children"]): FilterQuery {
	return {
		type: "group",
		id: "root",
		conjunction: "and",
		children,
		sortKey: "due",
		sortDirection: "asc",
		groupKey: "none",
	};
}

describe("FilterService and TaskManager filter-cache performance smoke", () => {
	it("measures large-vault filter option and query index paths", async () => {
		const { app, filterService, taskManager, allTaskPaths } = createLargeFilterFixture();

		let start = performance.now();
		const indexedTaskPaths = taskManager.getAllTaskPaths();
		const allTaskPathsDurationMs = performance.now() - start;
		const allTaskPathsMetadataReads = app.__metadataReads;
		expect(indexedTaskPaths.size).toBe(8000);

		app.__metadataReads = 0;
		start = performance.now();
		const firstOptions = await filterService.getFilterOptions();
		const firstOptionsDurationMs = performance.now() - start;
		const firstOptionsMetadataReads = app.__metadataReads;
		expect(firstOptions.tags).toContain("tag-99");
		expect(firstOptions.projects).toContain("[[Projects/Project-79.md]]");

		app.__metadataReads = 0;
		start = performance.now();
		const secondOptions = await filterService.getFilterOptions();
		const secondOptionsDurationMs = performance.now() - start;
		const secondOptionsMetadataReads = app.__metadataReads;
		expect(secondOptions).toBe(firstOptions);

		app.__metadataReads = 0;
		start = performance.now();
		const statusPaths = taskManager.getTaskPathsByStatus("open");
		const statusLookupDurationMs = performance.now() - start;
		const statusLookupMetadataReads = app.__metadataReads;
		expect(statusPaths.length).toBe(2000);

		app.__metadataReads = 0;
		start = performance.now();
		const scheduledPaths = taskManager.getTasksForDate("2026-07-08");
		const dateLookupDurationMs = performance.now() - start;
		const dateLookupMetadataReads = app.__metadataReads;
		expect(scheduledPaths.length).toBeGreaterThan(0);

		const query = queryWithConditions([
			{
				type: "condition",
				id: "status-open",
				property: "status",
				operator: "is",
				value: "open",
			},
			{
				type: "condition",
				id: "scheduled-day",
				property: "scheduled",
				operator: "is",
				value: "2026-07-01",
			},
		]);

		app.__metadataReads = 0;
		start = performance.now();
		const firstGroups = await filterService.getGroupedTasks(query);
		const firstGroupedDurationMs = performance.now() - start;
		const firstGroupedMetadataReads = app.__metadataReads;
		expect(firstGroups.get("all")?.length ?? 0).toBeGreaterThan(0);

		app.__metadataReads = 0;
		start = performance.now();
		const secondGroups = await filterService.getGroupedTasks(query);
		const secondGroupedDurationMs = performance.now() - start;
		const secondGroupedMetadataReads = app.__metadataReads;
		expect(secondGroups.get("all")?.length).toBe(firstGroups.get("all")?.length);

		const cachedQueryEntriesBeforeBodyEdit = filterService.getCacheStats().entryCount;
		app.__metadataReads = 0;
		start = performance.now();
		taskManager.updateTaskInfoInCache(allTaskPaths[0], {
			title: "Task 0 renamed",
			status: "open",
			priority: "low",
			path: allTaskPaths[0],
			archived: false,
			due: "2026-06-01",
			scheduled: "2026-07-01",
			tags: ["task", "tag-0"],
			contexts: ["context-0"],
			projects: ["[[Projects/Project-0.md]]"],
		});
		const bodyOnlyUpdateDurationMs = performance.now() - start;
		const bodyOnlyUpdateMetadataReads = app.__metadataReads;
		const cachedQueryEntriesAfterBodyEdit = filterService.getCacheStats().entryCount;
		const optionsAfterBodyEdit = await filterService.getFilterOptions();
		expect(optionsAfterBodyEdit).toBe(secondOptions);

		app.__metadataReads = 0;
		start = performance.now();
		taskManager.updateTaskInfoInCache(allTaskPaths[0], {
			title: "Task 0 renamed",
			status: "open",
			priority: "low",
			path: allTaskPaths[0],
			archived: false,
			due: "2026-06-01",
			scheduled: "2026-07-01",
			tags: ["task", "tag-0", "new-filter-tag"],
			contexts: ["context-0"],
			projects: ["[[Projects/Project-0.md]]"],
		});
		const indexedFieldUpdateDurationMs = performance.now() - start;
		const indexedFieldUpdateMetadataReads = app.__metadataReads;
		const cachedQueryEntriesAfterIndexedEdit = filterService.getCacheStats().entryCount;
		const optionsAfterIndexedEdit = await filterService.getFilterOptions();
		expect(optionsAfterIndexedEdit.tags).toContain("new-filter-tag");

		logMetric("large-filter-graph", {
			allTaskPathsDurationMs,
			allTaskPathsMetadataReads,
			firstOptionsDurationMs,
			firstOptionsMetadataReads,
			secondOptionsDurationMs,
			secondOptionsMetadataReads,
			statusLookupDurationMs,
			statusLookupMetadataReads,
			dateLookupDurationMs,
			dateLookupMetadataReads,
			firstGroupedDurationMs,
			firstGroupedMetadataReads,
			secondGroupedDurationMs,
			secondGroupedMetadataReads,
			bodyOnlyUpdateDurationMs,
			bodyOnlyUpdateMetadataReads,
			cachedQueryEntriesBeforeBodyEdit,
			cachedQueryEntriesAfterBodyEdit,
			indexedFieldUpdateDurationMs,
			indexedFieldUpdateMetadataReads,
			cachedQueryEntriesAfterIndexedEdit,
		});

		expect(secondOptionsMetadataReads).toBe(0);
		expect(firstOptionsMetadataReads).toBe(0);
		expect(statusLookupMetadataReads).toBe(0);
		expect(dateLookupMetadataReads).toBe(0);
		expect(firstGroupedMetadataReads).toBeLessThan(1000);
		expect(bodyOnlyUpdateMetadataReads).toBe(0);
		expect(cachedQueryEntriesAfterBodyEdit).toBe(cachedQueryEntriesBeforeBodyEdit);
		expect(indexedFieldUpdateMetadataReads).toBe(0);
		expect(cachedQueryEntriesAfterIndexedEdit).toBe(0);
	});
});
