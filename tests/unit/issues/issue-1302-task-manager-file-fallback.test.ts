import type { App } from "obsidian";
import { App as MockApp, MockObsidian } from "../../__mocks__/obsidian";
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

describe("Issue #1302: TaskManager file frontmatter fallback", () => {
	let app: App;
	let manager: TaskManager;

	beforeEach(() => {
		MockObsidian.reset();
		app = createMockApp();
		manager = createTaskManager(app);
	});

	it("reads task frontmatter from the vault file while metadata cache is missing", async () => {
		const path = "TaskNotes/Tasks/smoke-alarm-check.md";
		MockObsidian.createTestFile(
			path,
			[
				"---",
				JSON.stringify({
					title: "Smoke alarm check",
					status: "open",
					priority: "normal",
					scheduled: "2026-05-17",
					tags: ["task"],
				}),
				"---",
				"",
				"Check the hallway alarm.",
				"",
			].join("\n")
		);
		app.metadataCache.deleteCache(path);

		await expect(manager.getTaskInfo(path)).resolves.toMatchObject({
			path,
			title: "Smoke alarm check",
			status: "open",
			priority: "normal",
			scheduled: "2026-05-17",
		});

		const allTasks = await manager.getAllTasks();
		expect(allTasks.map((task) => task.path)).toContain(path);
	});

	it("does not classify non-task files from the fallback parse", async () => {
		const path = "Notes/reference.md";
		MockObsidian.createTestFile(
			path,
			[
				"---",
				JSON.stringify({ title: "Reference note", tags: ["reference"] }),
				"---",
				"",
			].join("\n")
		);
		app.metadataCache.deleteCache(path);

		await expect(manager.getTaskInfo(path)).resolves.toBeNull();
	});
});
