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
					id: "smoke-alarm-check-id",
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
			id: "smoke-alarm-check-id",
			path,
			title: "Smoke alarm check",
			status: "open",
			priority: "normal",
			scheduled: "2026-05-17",
		});

		const allTasks = await manager.getAllTasks();
		expect(allTasks.map((task) => task.path)).toContain(path);
		await expect(manager.getTaskInfoById("smoke-alarm-check-id")).resolves.toMatchObject({
			id: "smoke-alarm-check-id",
			path,
		});
	});

	it("leaves legacy tasks ID-less and refuses to select an arbitrary duplicate ID", async () => {
		const legacyPath = "TaskNotes/Tasks/legacy.md";
		const duplicateA = "TaskNotes/Tasks/duplicate-a.md";
		const duplicateB = "TaskNotes/Tasks/duplicate-b.md";
		MockObsidian.createTestFile(
			legacyPath,
			`---\n${JSON.stringify({ title: "Legacy", status: "open", tags: ["task"] })}\n---\n`
		);
		for (const path of [duplicateA, duplicateB]) {
			MockObsidian.createTestFile(
				path,
				`---\n${JSON.stringify({ id: "duplicate-id", title: path, status: "open", tags: ["task"] })}\n---\n`
			);
			app.metadataCache.deleteCache(path);
		}
		app.metadataCache.deleteCache(legacyPath);

		const legacyTask = await manager.getTaskInfo(legacyPath);
		expect(legacyTask).toMatchObject({ path: legacyPath });
		expect(legacyTask?.id).toBeUndefined();
		await expect(manager.getTasksById("duplicate-id")).resolves.toHaveLength(2);
		await expect(manager.getTaskInfoById("duplicate-id")).resolves.toBeNull();
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

	it("includes the file path when fallback frontmatter parsing fails", async () => {
		const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
		const path = "Notes/broken-frontmatter.md";
		const parseFrontmatter = (
			manager as unknown as {
				parseFrontmatterFromContent(content: string, path?: string): Record<string, unknown> | null;
			}
		).parseFrontmatterFromContent.bind(manager);

		expect(parseFrontmatter("---\ntitle: *missing-anchor\n---\nBody", path)).toBeNull();

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining(`TaskManager: Failed to parse frontmatter fallback for ${path}`),
			expect.objectContaining({ path }),
			expect.anything()
		);
		warnSpy.mockRestore();
	});
});
