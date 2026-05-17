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
};

function createMockApp(): MockApp {
	const files = new Map<string, TFile>();
	const metadata = new Map<string, { frontmatter: Record<string, unknown> }>();
	const metadataChangedHandlers: MetadataChangedHandler[] = [];

	return {
		__files: files,
		__metadata: metadata,
		__metadataChangedHandlers: metadataChangedHandlers,
		vault: {
			getMarkdownFiles: jest.fn(() => Array.from(files.values())),
			getAbstractFileByPath: jest.fn((path: string) => files.get(path) ?? null),
			on: jest.fn(() => ({})),
		},
		metadataCache: {
			getFileCache: jest.fn((file: TFile) => metadata.get(file.path) ?? null),
			getFirstLinkpathDest: jest.fn(),
			on: jest.fn((eventName: string, handler: MetadataChangedHandler) => {
				if (eventName === "changed") {
					metadataChangedHandlers.push(handler);
				}
				return {};
			}),
			offref: jest.fn(),
		},
	} as unknown as MockApp;
}

function createFile(app: MockApp, filePath: string, frontmatter?: Record<string, unknown>): TFile {
	const file = new TFile(filePath);
	app.__files.set(filePath, file);
	if (frontmatter) {
		app.__metadata.set(filePath, { frontmatter });
	}
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

describe("Issue #1227: relationships widget project detection refresh", () => {
	it("emits a dependency-cache change when a task starts referencing a project note", async () => {
		const app = createMockApp();
		const projectFile = createFile(app, "Projects/Alpha.md");
		const taskFile = createFile(app, "Tasks/Task.md");

		app.metadataCache.getFirstLinkpathDest = jest.fn((linkpath: string) =>
			linkpath === "Alpha" ? projectFile : null
		);

		const dependencyCache = createDependencyCache(app);
		const changeHandler = jest.fn();
		dependencyCache.on(EVENT_DEPENDENCY_CACHE_CHANGED, changeHandler);

		await dependencyCache.buildIndexes();
		changeHandler.mockClear();

		app.__metadata.set("Tasks/Task.md", {
			frontmatter: {
				title: "Task",
				tags: ["task"],
				projects: ["[[Alpha]]"],
			},
		});
		dependencyCache.initialize();
		app.__metadataChangedHandlers[0](taskFile, null, {});

		expect(dependencyCache.isFileUsedAsProject("Projects/Alpha.md")).toBe(true);
		expect(changeHandler).toHaveBeenCalledTimes(1);
	});
});
