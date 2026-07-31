import { TFile, type App } from "obsidian";
import { FieldMapper } from "../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING, DEFAULT_SETTINGS } from "../../src/settings/defaults";
import { DependencyCache, EVENT_DEPENDENCY_CACHE_CHANGED } from "../../src/utils/DependencyCache";

type MetadataChangedHandler = (file: TFile, data: unknown, cache: unknown) => void;

type MockApp = App & {
	__files: Map<string, TFile>;
	__metadata: Map<string, { frontmatter: Record<string, unknown> }>;
	__metadataChangedHandlers: MetadataChangedHandler[];
	__linkResolutionCalls: number;
};

interface LargeGraphFixture {
	app: MockApp;
	cache: DependencyCache;
	blockerPaths: string[];
	dependentPaths: string[];
	changeHandler: jest.Mock;
}

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

function createLargeGraph(blockerCount = 250, dependentCount = 2500): LargeGraphFixture {
	const app = createMockApp();
	const blockerPaths: string[] = [];
	const dependentPaths: string[] = [];

	for (let i = 0; i < blockerCount; i++) {
		const path = `Tasks/Blocker-${i}.md`;
		blockerPaths.push(path);
		createFile(app, path, {
			title: `Blocker ${i}`,
			status: "open",
			tags: ["task"],
		});
	}

	for (let i = 0; i < dependentCount; i++) {
		const blockerPath = blockerPaths[i % blockerPaths.length];
		const path = `Tasks/Dependent-${i}.md`;
		dependentPaths.push(path);
		createFile(app, path, {
			title: `Dependent ${i}`,
			status: "open",
			tags: ["task"],
			blockedBy: [{ uid: `[[${blockerPath}]]`, reltype: "FINISHTOSTART" }],
			projects: [`[[Projects/Project-${i % 20}.md]]`],
		});
	}

	for (let i = 0; i < 20; i++) {
		createFile(app, `Projects/Project-${i}.md`, {
			title: `Project ${i}`,
		});
	}

	const cache = createDependencyCache(app);
	const changeHandler = jest.fn();
	cache.on(EVENT_DEPENDENCY_CACHE_CHANGED, changeHandler);
	cache.initialize();

	return { app, cache, blockerPaths, dependentPaths, changeHandler };
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

function logMetric(label: string, metric: Record<string, number>): void {
	if (process.env.TN_PERF_LOG === "1") {
		process.stderr.write(`[dependency-cache-perf] ${label} ${JSON.stringify(metric)}\n`);
	}
}

describe("DependencyCache performance smoke", () => {
	it("measures large-graph build, edit, and read-heavy paths", async () => {
		const { app, cache, blockerPaths, dependentPaths, changeHandler } = createLargeGraph();

		let start = performance.now();
		await cache.buildIndexes();
		const buildDurationMs = performance.now() - start;
		const buildLinkResolutionCalls = app.__linkResolutionCalls;
		expect(cache.isTaskBlocked(dependentPaths[0])).toBe(true);
		expect(cache.getBlockedTaskPaths(blockerPaths[0]).length).toBeGreaterThan(0);

		app.__linkResolutionCalls = 0;
		changeHandler.mockClear();
		start = performance.now();
		for (const path of dependentPaths) {
			const entry = app.__metadata.get(path);
			if (!entry) continue;
			app.__metadata.set(path, {
				frontmatter: {
					...entry.frontmatter,
					details: "body-like metadata churn that does not affect relationships",
				},
			});
			invokeMetadataChanged(app, path);
		}
		const nonRelationshipEditDurationMs = performance.now() - start;
		const nonRelationshipEditLinkResolutionCalls = app.__linkResolutionCalls;
		const nonRelationshipEditEvents = changeHandler.mock.calls.length;

		app.__linkResolutionCalls = 0;
		changeHandler.mockClear();
		start = performance.now();
		const blockerEntry = app.__metadata.get(blockerPaths[0]);
		if (!blockerEntry) {
			throw new Error("Missing blocker metadata");
		}
		app.__metadata.set(blockerPaths[0], {
			frontmatter: {
				...blockerEntry.frontmatter,
				status: "done",
			},
		});
		invokeMetadataChanged(app, blockerPaths[0]);
		const statusChangeDurationMs = performance.now() - start;
		const statusChangeLinkResolutionCalls = app.__linkResolutionCalls;
		const statusChangeEvents = changeHandler.mock.calls.length;
		expect(cache.isTaskBlocked(dependentPaths[0])).toBe(false);

		app.__linkResolutionCalls = 0;
		(app.metadataCache.getFileCache as jest.Mock).mockClear();
		start = performance.now();
		for (const path of dependentPaths) {
			cache.isTaskBlocked(path);
		}
		for (const path of blockerPaths) {
			cache.getBlockedTaskPaths(path);
		}
		const readHeavyDurationMs = performance.now() - start;
		const readHeavyLinkResolutionCalls = app.__linkResolutionCalls;
		const readHeavyMetadataReads = (app.metadataCache.getFileCache as jest.Mock).mock.calls
			.length;

		logMetric("large-graph", {
			buildDurationMs,
			buildLinkResolutionCalls,
			nonRelationshipEditDurationMs,
			nonRelationshipEditLinkResolutionCalls,
			nonRelationshipEditEvents,
			statusChangeDurationMs,
			statusChangeLinkResolutionCalls,
			statusChangeEvents,
			readHeavyDurationMs,
			readHeavyLinkResolutionCalls,
			readHeavyMetadataReads,
		});

		expect(buildLinkResolutionCalls).toBeGreaterThan(0);
		expect(nonRelationshipEditLinkResolutionCalls).toBe(0);
		expect(nonRelationshipEditEvents).toBe(0);
		expect(statusChangeLinkResolutionCalls).toBe(0);
		expect(statusChangeEvents).toBe(1);
		expect(readHeavyLinkResolutionCalls).toBe(0);
		expect(readHeavyMetadataReads).toBe(0);
	});
});
