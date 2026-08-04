import type { App } from "obsidian";
import { App as MockApp, MockObsidian } from "../../helpers/obsidian-runtime";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING, DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { TaskManager } from "../../../src/utils/TaskManager";

const createMockApp = (): App => new MockApp() as unknown as App;

function createTaskManager(app: App): TaskManager {
	return new TaskManager(
		app,
		{
			...DEFAULT_SETTINGS,
			taskIdentificationMethod: "tag",
			taskTag: "task",
			excludedFolders: "",
			storeTitleInFilename: false,
		},
		new FieldMapper(DEFAULT_FIELD_MAPPING)
	);
}

function taskContent(title: string): string {
	return [
		"---",
		JSON.stringify({ title, status: "open", priority: "normal", tags: ["task"] }),
		"---",
		"",
	].join("\n");
}

describe("TaskManager metadata-cache reads", () => {
	let app: App;
	let manager: TaskManager;

	beforeEach(() => {
		MockObsidian.reset();
		app = createMockApp();
		manager = createTaskManager(app);
	});

	it("does not read an indexed file that has no frontmatter", async () => {
		const path = "Notes/plain-note.md";
		MockObsidian.createTestFile(path, "Plain note");
		app.metadataCache.setCache(path, {});
		const readSpy = jest.spyOn(app.vault, "read");

		await expect(manager.getTaskInfo(path)).resolves.toBeNull();
		expect(readSpy).not.toHaveBeenCalled();
	});

	it("preserves the disk fallback for a direct lookup with no cache entry", async () => {
		const path = "Tasks/unindexed.md";
		MockObsidian.createTestFile(path, taskContent("Unindexed task"));
		app.metadataCache.deleteCache(path);
		const readSpy = jest.spyOn(app.vault, "read");

		await expect(manager.getTaskInfo(path)).resolves.toMatchObject({
			path,
			title: "Unindexed task",
		});
		expect(readSpy).toHaveBeenCalledTimes(1);
	});

	it("keeps cache-only scans off disk and full scans able to find unindexed tasks", async () => {
		const cachedPath = "Tasks/cached.md";
		const unindexedPath = "Tasks/unindexed.md";
		MockObsidian.createTestFile(cachedPath, taskContent("Cached task"));
		MockObsidian.createTestFile(unindexedPath, taskContent("Unindexed task"));
		app.metadataCache.deleteCache(unindexedPath);
		const readSpy = jest.spyOn(app.vault, "read");

		expect(manager.getAllCachedTasks().map((task) => task.path)).toEqual([cachedPath]);
		expect(readSpy).not.toHaveBeenCalled();

		await expect(manager.getAllTasks()).resolves.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: cachedPath }),
				expect.objectContaining({ path: unindexedPath }),
			])
		);
		expect(readSpy).toHaveBeenCalledTimes(1);
	});
});
