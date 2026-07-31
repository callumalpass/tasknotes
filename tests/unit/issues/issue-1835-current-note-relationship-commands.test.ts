import { TFile } from "obsidian";
import { createTaskNotesCommandDefinitions } from "../../../src/commands/taskNotesCommands";
import {
	addTaskToProject,
	assignTaskAsSubtask,
} from "../../../src/services/taskRelationshipActions";
import { EVENT_USER_NOTICE } from "../../../src/core/userNotices";
import type { TaskInfo } from "../../../src/types";

function makePlugin() {
	return {
		app: {
			metadataCache: {
				fileToLinktext: (file: TFile) => file.path.replace(/\.md$/i, ""),
			},
		},
		settings: {
			useFrontmatterMarkdownLinks: false,
		},
		i18n: {
			translate: (key: string, params?: Record<string, string | number>) =>
				params ? `${key}:${Object.values(params).join(",")}` : key,
		},
		emitter: {
			trigger: jest.fn(),
		},
		updateTaskProperty: jest.fn(
			async (task: TaskInfo, property: keyof TaskInfo, value: unknown) => ({
				...task,
				[property]: value,
			})
		),
	};
}

describe("Issue #1835: current note relationship commands", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("registers hotkeyable commands for current-note project and subtask actions", async () => {
		const definitions = createTaskNotesCommandDefinitions({} as any);
		const addProject = definitions.find(
			(definition) => definition.id === "add-project-to-current-task"
		);
		const addSubtask = definitions.find(
			(definition) => definition.id === "add-subtask-to-current-note"
		);
		const ctx = {
			addProjectToCurrentTask: jest.fn(),
			addSubtaskToCurrentNote: jest.fn(),
		};

		expect(addProject?.nameKey).toBe("commands.addProjectToCurrentTask");
		expect(addSubtask?.nameKey).toBe("commands.addSubtaskToCurrentNote");

		await addProject?.callback?.(ctx as any);
		await addSubtask?.callback?.(ctx as any);

		expect(ctx.addProjectToCurrentTask).toHaveBeenCalledTimes(1);
		expect(ctx.addSubtaskToCurrentNote).toHaveBeenCalledTimes(1);
	});

	it("adds a selected project to a task using the same relationship update path", async () => {
		const plugin = makePlugin();
		const task = {
			title: "Task",
			path: "Tasks/task.md",
			projects: [],
		} as TaskInfo;
		const projectFile = new TFile("Projects/Alpha.md");

		const updatedTask = await addTaskToProject(plugin as any, task, projectFile);

		expect(plugin.updateTaskProperty).toHaveBeenCalledWith(task, "projects", [
			"[[Projects/Alpha]]",
		]);
		expect(updatedTask?.projects).toEqual(["[[Projects/Alpha]]"]);
		expect(plugin.emitter.trigger).toHaveBeenCalledWith(
			EVENT_USER_NOTICE,
			expect.objectContaining({
				message: "contextMenus.task.organization.notices.addedToProject:Alpha",
			})
		);
	});

	it("adds the current note as the selected task's project when assigning a subtask", async () => {
		const plugin = makePlugin();
		const parentFile = new TFile("Projects/Alpha.md");
		const subtask = {
			title: "Subtask",
			path: "Tasks/subtask.md",
			projects: [],
		} as TaskInfo;

		const updatedTask = await assignTaskAsSubtask(plugin as any, parentFile, subtask);

		expect(plugin.updateTaskProperty).toHaveBeenCalledWith(subtask, "projects", [
			"[[Projects/Alpha]]",
		]);
		expect(updatedTask?.projects).toEqual(["[[Projects/Alpha]]"]);
		expect(plugin.emitter.trigger).toHaveBeenCalledWith(
			EVENT_USER_NOTICE,
			expect.objectContaining({
				message: "contextMenus.task.organization.notices.addedAsSubtask:Subtask,Alpha",
			})
		);
	});

	it("does not rewrite a task that is already linked to the selected project", async () => {
		const plugin = makePlugin();
		const task = {
			title: "Task",
			path: "Tasks/task.md",
			projects: ["[[Alpha]]"],
		} as TaskInfo;
		const projectFile = new TFile("Projects/Alpha.md");

		const updatedTask = await addTaskToProject(plugin as any, task, projectFile);

		expect(updatedTask).toBeNull();
		expect(plugin.updateTaskProperty).not.toHaveBeenCalled();
		expect(plugin.emitter.trigger).toHaveBeenCalledWith(
			EVENT_USER_NOTICE,
			expect.objectContaining({
				message: "contextMenus.task.organization.notices.alreadyInProject",
			})
		);
	});
});
