import { TFile, type App } from "obsidian";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { PriorityManager } from "../../../src/services/PriorityManager";
import { StatusManager } from "../../../src/services/StatusManager";
import { DEFAULT_FIELD_MAPPING, DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import type { PriorityConfig, StatusConfig } from "../../../src/types";
import { TaskManager } from "../../../src/utils/TaskManager";

jest.mock("obsidian");

const statuses: StatusConfig[] = [
	{
		id: "open",
		value: "open",
		label: "Open",
		color: "#808080",
		isCompleted: false,
		order: 1,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
	{
		id: "done",
		value: "done",
		label: "Done",
		color: "#00aa00",
		isCompleted: true,
		order: 2,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
];

const priorities: PriorityConfig[] = [
	{
		id: "normal",
		value: "normal",
		label: "Normal",
		color: "#ffaa00",
		weight: 1,
	},
	{
		id: "high",
		value: "high",
		label: "High Priority",
		color: "#ff0000",
		weight: 2,
	},
];

type MockApp = App & {
	__files: Map<string, TFile>;
	__metadata: Map<string, { frontmatter: Record<string, unknown> }>;
};

function createMockApp(): MockApp {
	const files = new Map<string, TFile>();
	const metadata = new Map<string, { frontmatter: Record<string, unknown> }>();

	return {
		__files: files,
		__metadata: metadata,
		vault: {
			getMarkdownFiles: jest.fn(() => Array.from(files.values())),
			getAbstractFileByPath: jest.fn((path: string) => files.get(path) ?? null),
			on: jest.fn(),
		},
		metadataCache: {
			getFileCache: jest.fn((file: TFile) => metadata.get(file.path) ?? null),
			on: jest.fn(),
			offref: jest.fn(),
		},
	} as unknown as MockApp;
}

function createTaskFile(app: MockApp, path: string, frontmatter: Record<string, unknown>): void {
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
			customStatuses: statuses,
			customPriorities: priorities,
		},
		new FieldMapper(DEFAULT_FIELD_MAPPING, [], statuses, priorities)
	);
}

describe("Issue #1374: native property labels are recognized", () => {
	it("normalizes status and priority labels when reading frontmatter", () => {
		const fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING, [], statuses, priorities);

		const task = fieldMapper.mapFromFrontmatter(
			{
				title: "Manual task",
				tags: ["task"],
				status: "Done",
				priority: "High Priority",
			},
			"Tasks/manual.md"
		);

		expect(task.status).toBe("done");
		expect(task.priority).toBe("high");
	});

	it("resolves labels and case variants through status and priority managers", () => {
		const statusManager = new StatusManager(statuses);
		const priorityManager = new PriorityManager(priorities);

		expect(statusManager.getStatusConfig("Done")?.value).toBe("done");
		expect(statusManager.getStatusConfig("DONE")?.value).toBe("done");
		expect(statusManager.isCompletedStatus("Done")).toBe(true);

		expect(priorityManager.getPriorityConfig("High Priority")?.value).toBe("high");
		expect(priorityManager.getPriorityConfig("HIGH PRIORITY")?.value).toBe("high");
		expect(priorityManager.getPriorityWeight("High Priority")).toBe(2);
	});

	it("matches label values in TaskManager status and priority indexes", async () => {
		const app = createMockApp();
		createTaskFile(app, "Tasks/manual.md", {
			title: "Manual task",
			tags: ["task"],
			status: "Done",
			priority: "High Priority",
		});

		const taskManager = createTaskManager(app);

		await expect(taskManager.getTaskInfo("Tasks/manual.md")).resolves.toMatchObject({
			status: "done",
			priority: "high",
		});
		expect(taskManager.getTaskPathsByStatus("done")).toEqual(["Tasks/manual.md"]);
		expect(taskManager.getTaskPathsByStatus("Done")).toEqual(["Tasks/manual.md"]);
		expect(taskManager.getTaskPathsByPriority("high")).toEqual(["Tasks/manual.md"]);
		expect(taskManager.getTaskPathsByPriority("High Priority")).toEqual(["Tasks/manual.md"]);
		expect(taskManager.getAllStatuses()).toEqual(["done"]);
		expect(taskManager.getAllPriorities()).toEqual(["high"]);
	});
});
