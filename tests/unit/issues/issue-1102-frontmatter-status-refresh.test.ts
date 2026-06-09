import { App, TFile } from "obsidian";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING, DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { EVENT_TASK_UPDATED } from "../../../src/types";
import { TaskManager } from "../../../src/utils/TaskManager";
import { MockObsidian } from "../../helpers/obsidian-runtime";

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

describe("Issue #1102: frontmatter status changes refresh task cards", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("emits a task-updated event with fresh task data when task frontmatter changes", async () => {
		const app = new App() as unknown as App;
		const manager = createTaskManager(app);
		const path = "Tasks/frontmatter-status.md";
		const file = new TFile(path);
		const events: unknown[] = [];

		manager.on(EVENT_TASK_UPDATED, (event) => {
			events.push(event);
		});

		await (
			manager as unknown as {
				handleFileChanged(file: TFile, cache: unknown): Promise<void>;
			}
		).handleFileChanged(file, {
			frontmatter: {
				title: "Frontmatter status",
				status: "done",
				priority: "normal",
				tags: ["task"],
			},
		});

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			path,
			updatedTask: {
				path,
				title: "Frontmatter status",
				status: "done",
				priority: "normal",
			},
		});
	});

	it("does not emit task-updated for non-task frontmatter changes", async () => {
		const app = new App() as unknown as App;
		const manager = createTaskManager(app);
		const events: unknown[] = [];

		manager.on(EVENT_TASK_UPDATED, (event) => {
			events.push(event);
		});

		await (
			manager as unknown as {
				handleFileChanged(file: TFile, cache: unknown): Promise<void>;
			}
		).handleFileChanged(new TFile("Notes/plain-note.md"), {
			frontmatter: {
				title: "Plain note",
				tags: ["meeting"],
			},
		});

		expect(events).toEqual([]);
	});
});
