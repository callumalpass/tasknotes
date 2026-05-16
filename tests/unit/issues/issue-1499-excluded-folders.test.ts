import { TFile, type App } from "obsidian";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING, DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { DependencyCache } from "../../../src/utils/DependencyCache";
import { TaskManager } from "../../../src/utils/TaskManager";
import { isPathInExcludedFolder, parseExcludedFolders } from "../../../src/utils/pathExclusions";

jest.mock("obsidian");

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
			getFirstLinkpathDest: jest.fn(),
			on: jest.fn(),
			offref: jest.fn(),
		},
	} as unknown as MockApp;
}

function createTaskFile(app: MockApp, path: string, frontmatter: Record<string, unknown>): TFile {
	const file = new TFile(path);
	app.__files.set(path, file);
	app.__metadata.set(path, { frontmatter });
	return file;
}

function makeTaskManager(app: MockApp, excludedFolders: string): TaskManager {
	return new TaskManager(
		app,
		{
			...DEFAULT_SETTINGS,
			taskIdentificationMethod: "tag",
			taskTag: "task",
			excludedFolders,
			storeTitleInFilename: false,
		},
		new FieldMapper(DEFAULT_FIELD_MAPPING)
	);
}

function makeDependencyCache(app: MockApp, excludedFolders: string): DependencyCache {
	return new DependencyCache(
		app,
		{
			...DEFAULT_SETTINGS,
			taskIdentificationMethod: "tag",
			taskTag: "task",
			excludedFolders,
		},
		new FieldMapper(DEFAULT_FIELD_MAPPING),
		{ isCompletedStatus: jest.fn((status: string) => status === "done") } as never,
		(frontmatter) => Array.isArray((frontmatter as { tags?: unknown }).tags)
	);
}

describe("Issue #1499: excluded folders apply to task indexing", () => {
	it("matches excluded folders by vault path segment boundaries", () => {
		const excludedFolders = parseExcludedFolders("Extra/Template, /Absolute/Archive/ ");

		expect(isPathInExcludedFolder("Extra/Template/task.md", excludedFolders)).toBe(true);
		expect(isPathInExcludedFolder("Extra/Template", excludedFolders)).toBe(true);
		expect(isPathInExcludedFolder("Extra/Templates/task.md", excludedFolders)).toBe(false);
		expect(isPathInExcludedFolder("Absolute/Archive/task.md", excludedFolders)).toBe(true);
	});

	it("does not return tasks from excluded folders through direct task reads", async () => {
		const app = createMockApp();
		createTaskFile(app, "Extra/Template/template-task.md", {
			title: "Template task",
			status: "open",
			tags: ["task"],
		});
		createTaskFile(app, "Extra/Templates/real-task.md", {
			title: "Real task",
			status: "open",
			tags: ["task"],
		});

		const manager = makeTaskManager(app, "Extra/Template");

		await expect(manager.getTaskInfo("Extra/Template/template-task.md")).resolves.toBeNull();
		expect(manager.getCachedTaskInfoSync("Extra/Template/template-task.md")).toBeNull();
		expect(manager.getAllTaskPaths().has("Extra/Template/template-task.md")).toBe(false);

		await expect(manager.getTaskInfo("Extra/Templates/real-task.md")).resolves.toMatchObject({
			path: "Extra/Templates/real-task.md",
			title: "Real task",
		});
	});

	it("rebuilds dependency indexes when folders become excluded", async () => {
		const app = createMockApp();
		const blockerPath = "Extra/Template/blocker.md";
		const dependentPath = "Tasks/dependent.md";

		const blockerFile = createTaskFile(app, blockerPath, {
			title: "Excluded blocker",
			status: "open",
			tags: ["task"],
		});
		createTaskFile(app, dependentPath, {
			title: "Dependent",
			status: "open",
			tags: ["task"],
			blockedBy: [{ uid: "[[blocker]]", reltype: "FINISHTOSTART" }],
		});

		app.metadataCache.getFirstLinkpathDest = jest.fn((linkpath: string) =>
			linkpath === "blocker" ? blockerFile : null
		);

		const dependencyCache = makeDependencyCache(app, "");
		await dependencyCache.buildIndexes();
		expect(dependencyCache.isTaskBlocked(dependentPath)).toBe(true);
		expect(dependencyCache.getBlockedTaskPaths(blockerPath)).toEqual([dependentPath]);

		dependencyCache.updateConfig({
			...DEFAULT_SETTINGS,
			excludedFolders: "Extra/Template",
		});

		expect(dependencyCache.isTaskBlocked(dependentPath)).toBe(false);
		expect(dependencyCache.getBlockedTaskPaths(blockerPath)).toEqual([]);
	});
});
