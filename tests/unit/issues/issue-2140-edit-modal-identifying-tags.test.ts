import type { App } from "obsidian";
import { createI18nService } from "../../../src/i18n";
import { TaskEditModal } from "../../../src/modals/TaskEditModal";
import {
	buildTaskEditFormState,
	type TaskEditFormStateSettings,
} from "../../../src/modals/taskEditFormState";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import type { TaskInfo } from "../../../src/types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Look for ping pong table on facebook marketplace",
		status: "open",
		priority: "normal",
		path: "TaskNotes/Look for ping pong table on facebook marketplace.md",
		archived: false,
		contexts: [],
		projects: [],
		tags: [],
		...overrides,
	};
}

async function createModal(tags: string | string[], settings: TaskEditFormStateSettings = {}) {
	MockObsidian.reset();
	const app = MockObsidian.createMockApp() as unknown as App;
	const task = createTask({ tags: tags as unknown as string[] });
	const plugin = {
		i18n: createI18nService(),
		settings: {
			taskIdentificationMethod: "tag",
			taskTag: "task",
			hideIdentifyingTagsInCards: false,
			hideIdentifyingTagsMode: "all",
			userFields: [],
			...settings,
		},
		taskService: {
			updateTask: jest.fn(async (original: TaskInfo, changes: Partial<TaskInfo>) => ({
				...original,
				...changes,
			})),
		},
	};
	const modal = new TaskEditModal(app, plugin as never, { task });
	const state = modal as unknown as {
		initializeSubtasks: jest.Mock;
		tags: string;
		getChanges: () => Partial<TaskInfo>;
	};
	state.initializeSubtasks = jest.fn().mockResolvedValue(undefined);
	await modal.initializeFormData();
	return { modal, state, task, updateTask: plugin.taskService.updateTask };
}

const tagFormats: Array<[string, string | string[]]> = [
	["bare list", ["task", "task/context/onscreen", "health"]],
	["prefixed list", ["#task", "#task/context/onscreen", "#health"]],
	["bare scalar", "task/context/onscreen"],
	["prefixed scalar", "#task/context/onscreen"],
];

describe("issue #2140 edit modal identifying tags", () => {
	it.each(tagFormats)("saves removal of visible nested tags from %s", async (_name, tags) => {
		const { modal, state, task, updateTask } = await createModal(tags);
		expect(state.tags).toContain("task/context/onscreen");

		state.tags = Array.isArray(tags) ? "task, health" : "task";
		// The same change set drives unsaved-change detection and saving.
		expect(state.getChanges().tags).not.toContain("task/context/onscreen");
		await modal.handleSave();

		expect(updateTask).toHaveBeenCalledWith(
			task,
			expect.objectContaining({
				tags: Array.isArray(tags) ? ["health", "task"] : ["task"],
			})
		);
	});

	it.each(tagFormats)("saves replacement of visible nested tags from %s", async (_name, tags) => {
		const { modal, state, task, updateTask } = await createModal(tags);
		state.tags = "task, task/context/research";
		await modal.handleSave();

		expect(updateTask).toHaveBeenCalledWith(
			task,
			expect.objectContaining({
				tags: ["task", "task/context/research"],
			})
		);
	});

	it.each(tagFormats)("does not rewrite untouched tags from %s", async (_name, tags) => {
		const { modal, state, updateTask } = await createModal(tags);
		expect(state.getChanges()).toEqual({});
		await modal.handleSave();
		expect(updateTask).not.toHaveBeenCalled();
	});

	it.each([false, true])("keeps hidden nested tags with prefixes=%s", async (prefixed) => {
		const tags = ["task/context/onscreen", "health"].map((tag) => (prefixed ? `#${tag}` : tag));
		const { modal, state, task, updateTask } = await createModal(tags, {
			hideIdentifyingTagsInCards: true,
		});
		expect(state.tags).toBe("health");
		state.tags = "wellness";
		await modal.handleSave();
		expect(updateTask).toHaveBeenCalledWith(
			task,
			expect.objectContaining({
				tags: ["task/context/onscreen", "wellness"],
			})
		);
	});

	it("allows editing child tags in exact-only hiding mode", async () => {
		const { modal, state, task, updateTask } = await createModal(
			["task", "task/context/onscreen", "health"],
			{ hideIdentifyingTagsInCards: true, hideIdentifyingTagsMode: "exact-only" }
		);
		expect(state.tags).toBe("task/context/onscreen, health");
		state.tags = "health";
		await modal.handleSave();
		expect(updateTask).toHaveBeenCalledWith(
			task,
			expect.objectContaining({ tags: ["health", "task"] })
		);
	});

	it.each(["task", "#task", ["task"], ["#task"]])(
		"protects the exact task identifier in %j",
		async (tags) => {
			const { modal, state, updateTask } = await createModal(tags);
			state.tags = "";
			await modal.handleSave();
			const savedTags = updateTask.mock.calls[0]?.[1].tags ?? tags;
			expect([savedTags].flat().map((tag) => tag.replace(/^#/, ""))).toEqual(["task"]);
		}
	);

	it("clears visible child tags without removing the task identifier", async () => {
		const { modal, state, task, updateTask } = await createModal([
			"task",
			"task/context/onscreen",
			"health",
		]);
		state.tags = "";
		await modal.handleSave();
		expect(updateTask).toHaveBeenCalledWith(task, expect.objectContaining({ tags: ["task"] }));
	});

	it.each(["health", "#health", ["health"], ["#health"]])(
		"edits ordinary tags in %j",
		async (tags) => {
			const { modal, state, task, updateTask } = await createModal(tags, {
				taskIdentificationMethod: "property",
			});
			state.tags = "wellness";
			await modal.handleSave();
			expect(updateTask).toHaveBeenCalledWith(
				task,
				expect.objectContaining({ tags: ["wellness"] })
			);
		}
	);

	it("allows removing task-named tags in property mode even when hiding is enabled", async () => {
		const { modal, state, task, updateTask } = await createModal(
			["task", "task/context/onscreen", "health"],
			{
				taskIdentificationMethod: "property",
				hideIdentifyingTagsInCards: true,
			}
		);
		state.tags = "health";
		await modal.handleSave();
		expect(updateTask).toHaveBeenCalledWith(
			task,
			expect.objectContaining({ tags: ["health"] })
		);
	});

	it("keeps saved task-identification tags visible when hiding is disabled", () => {
		const state = buildTaskEditFormState({
			task: createTask({
				tags: ["health", "task", "task/context/onscreen", "task/context/research"],
			}),
			details: "",
			frontmatter: {},
			settings: {
				taskIdentificationMethod: "tag",
				taskTag: "task",
				hideIdentifyingTagsMode: "all",
			},
			normalizeDetails: (value) => value,
		});

		expect(state.tags).toBe("health, task, task/context/onscreen, task/context/research");
		expect(state.initialTags).toBe(state.tags);
	});
});
