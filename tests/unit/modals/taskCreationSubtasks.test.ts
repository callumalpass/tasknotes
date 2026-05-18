import { TFile } from "obsidian";
import type { TaskInfo } from "../../../src/types";
import {
	applyTaskCreationSubtaskAssignments,
	getSubtaskProjectAssignmentUpdate,
} from "../../../src/modals/taskCreationSubtasks";

function file(path: string): TFile {
	return new TFile(path);
}

function task(path: string, projects?: string[]): TaskInfo {
	return {
		title: path,
		status: "open",
		priority: "normal",
		path,
		archived: false,
		projects,
	};
}

describe("taskCreationSubtasks", () => {
	it("plans project updates only when the subtask is not already linked to the new parent", () => {
		expect(
			getSubtaskProjectAssignmentUpdate(
				["[[Existing]]"],
				"[[Tasks/Parent|Parent]]",
				"[[Parent]]"
			)
		).toEqual(["[[Existing]]", "[[Tasks/Parent|Parent]]"]);

		expect(
			getSubtaskProjectAssignmentUpdate(
				["[[Tasks/Parent|Parent]]"],
				"[[Tasks/Parent|Parent]]",
				"[[Parent]]"
			)
		).toBeNull();

		expect(
			getSubtaskProjectAssignmentUpdate(
				["[[Parent]]"],
				"[[Tasks/Parent|Parent]]",
				"[[Parent]]"
			)
		).toBeNull();
	});

	it("assigns the created task as a project on selected subtasks", async () => {
		const parent = file("Tasks/Parent.md");
		const child = file("Tasks/Child.md");
		const childTask = task(child.path, ["[[Existing]]"]);
		const updateTaskProjects = jest.fn().mockResolvedValue(undefined);

		const result = await applyTaskCreationSubtaskAssignments({
			currentTaskFile: parent,
			subtaskFiles: [child],
			getTaskInfo: async () => childTask,
			buildProjectReference: () => "[[Tasks/Parent|Parent]]",
			updateTaskProjects,
		});

		expect(updateTaskProjects).toHaveBeenCalledWith(childTask, [
			"[[Existing]]",
			"[[Tasks/Parent|Parent]]",
		]);
		expect(result).toEqual({ updated: 1, missing: 0, skipped: 0, failed: 0 });
	});

	it("tracks missing, skipped, and failed subtask assignments while continuing", async () => {
		const parent = file("Tasks/Parent.md");
		const missing = file("Tasks/Missing.md");
		const skipped = file("Tasks/Skipped.md");
		const failing = file("Tasks/Failing.md");
		const updating = file("Tasks/Updating.md");
		const error = new Error("write failed");
		const onError = jest.fn();
		const updateTaskProjects = jest.fn(async (subtask: TaskInfo) => {
			if (subtask.path === failing.path) {
				throw error;
			}
		});
		const tasks = new Map<string, TaskInfo | null>([
			[missing.path, null],
			[skipped.path, task(skipped.path, ["[[Parent]]"])],
			[failing.path, task(failing.path, [])],
			[updating.path, task(updating.path, [])],
		]);

		const result = await applyTaskCreationSubtaskAssignments({
			currentTaskFile: parent,
			subtaskFiles: [missing, skipped, failing, updating],
			getTaskInfo: async (path) => tasks.get(path),
			buildProjectReference: () => "[[Tasks/Parent|Parent]]",
			updateTaskProjects,
			onError,
		});

		expect(updateTaskProjects).toHaveBeenCalledTimes(2);
		expect(onError).toHaveBeenCalledWith(error, failing);
		expect(result).toEqual({ updated: 1, missing: 1, skipped: 1, failed: 1 });
	});

	it("does nothing when the created task file is unavailable", async () => {
		const updateTaskProjects = jest.fn();

		const result = await applyTaskCreationSubtaskAssignments({
			currentTaskFile: null,
			subtaskFiles: [file("Tasks/Child.md")],
			getTaskInfo: jest.fn(),
			buildProjectReference: jest.fn(),
			updateTaskProjects,
		});

		expect(updateTaskProjects).not.toHaveBeenCalled();
		expect(result).toEqual({ updated: 0, missing: 0, skipped: 0, failed: 0 });
	});
});
