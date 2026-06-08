import { TFile, type App } from "obsidian";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING, DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import {
	DependencyCache,
	EVENT_DEPENDENCY_CACHE_CHANGED,
} from "../../../src/utils/DependencyCache";

jest.mock("obsidian");

type MetadataChangedHandler = (file: TFile, data: unknown, cache: unknown) => void;

type MockApp = App & {
	__files: Map<string, TFile>;
	__metadata: Map<string, { frontmatter: Record<string, unknown> }>;
	__metadataChangedHandlers: MetadataChangedHandler[];
	__linkResolutionCalls: number;
};

function createMockApp(): MockApp {
	const files = new Map<string, TFile>();
	const metadata = new Map<string, { frontmatter: Record<string, unknown> }>();
	const metadataChangedHandlers: MetadataChangedHandler[] = [];

	const app = {
		__files: files,
		__metadata: metadata,
		__metadataChangedHandlers: metadataChangedHandlers,
		__linkResolutionCalls: 0,
		vault: {
			getMarkdownFiles: jest.fn(() => Array.from(files.values())),
			getAbstractFileByPath: jest.fn((path: string) => files.get(path) ?? null),
			on: jest.fn(() => ({})),
		},
		metadataCache: {
			getFileCache: jest.fn((file: TFile) => metadata.get(file.path) ?? null),
			getFirstLinkpathDest: jest.fn((linkpath: string) => {
				app.__linkResolutionCalls++;
				return files.get(linkpath) ?? files.get(`${linkpath}.md`) ?? null;
			}),
			on: jest.fn((eventName: string, handler: MetadataChangedHandler) => {
				if (eventName === "changed") {
					metadataChangedHandlers.push(handler);
				}
				return {};
			}),
			offref: jest.fn(),
		},
	} as unknown as MockApp;

	return app;
}

function createFile(app: MockApp, path: string, frontmatter: Record<string, unknown>): TFile {
	const file = new TFile(path);
	app.__files.set(path, file);
	app.__metadata.set(path, { frontmatter });
	return file;
}

function createDependencyCache(app: MockApp): DependencyCache {
	return new DependencyCache(
		app,
		{
			...DEFAULT_SETTINGS,
			taskIdentificationMethod: "tag",
			taskTag: "task",
		},
		new FieldMapper(DEFAULT_FIELD_MAPPING),
		{ isCompletedStatus: jest.fn((status: string) => status === "done") } as never,
		(frontmatter) => Array.isArray((frontmatter as { tags?: unknown }).tags)
	);
}

function invokeMetadataChanged(app: MockApp, path: string): void {
	const file = app.__files.get(path);
	if (!file) {
		throw new Error(`Missing file ${path}`);
	}
	const cache = app.__metadata.get(path) ?? null;
	for (const handler of app.__metadataChangedHandlers) {
		handler(file, null, cache);
	}
}

describe("DependencyCache optimized relationship updates", () => {
	it("skips link resolution when task metadata changes without relationship changes", async () => {
		const app = createMockApp();
		createFile(app, "Tasks/Blocker.md", {
			title: "Blocker",
			status: "open",
			tags: ["task"],
		});
		createFile(app, "Projects/Alpha.md", {
			title: "Alpha",
		});
		createFile(app, "Tasks/Dependent.md", {
			title: "Dependent",
			status: "open",
			tags: ["task"],
			blockedBy: [{ uid: "[[Tasks/Blocker.md]]", reltype: "FINISHTOSTART" }],
			projects: ["[[Projects/Alpha.md]]"],
		});

		const cache = createDependencyCache(app);
		const changeHandler = jest.fn();
		cache.on(EVENT_DEPENDENCY_CACHE_CHANGED, changeHandler);
		cache.initialize();
		await cache.buildIndexes();
		changeHandler.mockClear();
		app.__linkResolutionCalls = 0;

		app.__metadata.set("Tasks/Dependent.md", {
			frontmatter: {
				title: "Dependent renamed",
				status: "open",
				tags: ["task"],
				blockedBy: [{ uid: "[[Tasks/Blocker.md]]", reltype: "FINISHTOSTART" }],
				projects: ["[[Projects/Alpha.md]]"],
			},
		});
		invokeMetadataChanged(app, "Tasks/Dependent.md");

		expect(app.__linkResolutionCalls).toBe(0);
		expect(changeHandler).not.toHaveBeenCalled();
		expect(cache.isTaskBlocked("Tasks/Dependent.md")).toBe(true);
		expect(cache.isFileUsedAsProject("Projects/Alpha.md")).toBe(true);
	});

	it("updates status-aware active relationships without re-resolving dependency links", async () => {
		const app = createMockApp();
		createFile(app, "Tasks/Blocker.md", {
			title: "Blocker",
			status: "open",
			tags: ["task"],
		});
		createFile(app, "Tasks/Dependent.md", {
			title: "Dependent",
			status: "open",
			tags: ["task"],
			blockedBy: [{ uid: "[[Tasks/Blocker.md]]", reltype: "FINISHTOSTART" }],
		});

		const cache = createDependencyCache(app);
		const changeHandler = jest.fn();
		cache.on(EVENT_DEPENDENCY_CACHE_CHANGED, changeHandler);
		cache.initialize();
		await cache.buildIndexes();
		changeHandler.mockClear();
		app.__linkResolutionCalls = 0;

		expect(cache.isTaskBlocked("Tasks/Dependent.md")).toBe(true);
		expect(cache.getBlockedTaskPaths("Tasks/Blocker.md")).toEqual(["Tasks/Dependent.md"]);

		app.__metadata.set("Tasks/Blocker.md", {
			frontmatter: {
				title: "Blocker",
				status: "done",
				tags: ["task"],
			},
		});
		invokeMetadataChanged(app, "Tasks/Blocker.md");

		expect(app.__linkResolutionCalls).toBe(0);
		expect(changeHandler).toHaveBeenCalledTimes(1);
		expect(cache.isTaskBlocked("Tasks/Dependent.md")).toBe(false);
		expect(cache.getBlockedTaskPaths("Tasks/Blocker.md")).toEqual([]);
	});
});
