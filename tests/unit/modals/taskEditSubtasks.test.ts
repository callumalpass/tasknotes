import {
	applyTaskEditSubtaskChanges,
	buildTaskEditSubtaskChangePlan,
	getTaskEditSubtaskProjectRemovalUpdate,
	hasTaskEditSubtaskChanges,
} from "../../../src/modals/taskEditSubtasks";
import type { TaskInfo } from "../../../src/types";

const parentFile = {
	path: "Tasks/Parent.md",
	basename: "Parent",
};

function createTask(path: string, projects: unknown = []): TaskInfo {
	return {
		title: path.split("/").pop()?.replace(/\.md$/, "") || path,
		status: "open",
		priority: "normal",
		path,
		archived: false,
		projects: projects as string[],
	};
}

describe("taskEditSubtasks", () => {
	it("detects subtask changes without depending on order", () => {
		expect(
			hasTaskEditSubtaskChanges(
				[{ path: "Tasks/a.md" }, { path: "Tasks/b.md" }],
				[{ path: "Tasks/b.md" }, { path: "Tasks/a.md" }]
			)
		).toBe(false);
		expect(
			hasTaskEditSubtaskChanges(
				[{ path: "Tasks/a.md" }],
				[{ path: "Tasks/a.md" }, { path: "Tasks/b.md" }]
			)
		).toBe(true);
	});

	it("builds add and remove plans from initial and selected paths", () => {
		const initial = [{ path: "Tasks/remove.md" }, { path: "Tasks/keep.md" }];
		const selected = [{ path: "Tasks/keep.md" }, { path: "Tasks/add.md" }];

		expect(buildTaskEditSubtaskChangePlan(initial, selected)).toEqual({
			toRemove: [{ path: "Tasks/remove.md" }],
			toAdd: [{ path: "Tasks/add.md" }],
		});
	});

	it("adds and removes project references through injected task callbacks", async () => {
		const tasks = new Map<string, TaskInfo>([
			[
				"Tasks/remove.md",
				createTask("Tasks/remove.md", ["[[Tasks/Parent]]", "[[Parent]]", "[[Other]]"]),
			],
			["Tasks/add.md", createTask("Tasks/add.md", ["[[Other]]"])],
		]);
		const updateTaskProjects = jest.fn(async (task: TaskInfo, projects: string[]) => {
			task.projects = projects;
		});

		const result = await applyTaskEditSubtaskChanges({
			parentTaskFile: parentFile,
			initialSubtaskFiles: [{ path: "Tasks/remove.md" }],
			selectedSubtaskFiles: [{ path: "Tasks/add.md" }],
			getTaskInfo: async (path) => tasks.get(path),
			buildProjectReference: () => "[[Tasks/Parent]]",
			updateTaskProjects,
		});

		expect(updateTaskProjects).toHaveBeenCalledTimes(2);
		expect(tasks.get("Tasks/remove.md")?.projects).toEqual(["[[Other]]"]);
		expect(tasks.get("Tasks/add.md")?.projects).toEqual([
			"[[Other]]",
			"[[Tasks/Parent]]",
		]);
		expect(result).toMatchObject({
			added: 1,
			removed: 1,
			skippedMissing: 0,
			skippedExisting: 0,
			errors: 0,
			nextInitialSubtaskFiles: [{ path: "Tasks/add.md" }],
		});
	});

	it("skips add updates when the child already contains the project or legacy reference", async () => {
		const tasks = new Map<string, TaskInfo>([
			["Tasks/legacy.md", createTask("Tasks/legacy.md", ["[[Parent]]"])],
		]);
		const updateTaskProjects = jest.fn();

		const result = await applyTaskEditSubtaskChanges({
			parentTaskFile: parentFile,
			initialSubtaskFiles: [],
			selectedSubtaskFiles: [{ path: "Tasks/legacy.md" }],
			getTaskInfo: async (path) => tasks.get(path),
			buildProjectReference: () => "[[Tasks/Parent]]",
			updateTaskProjects,
		});

		expect(updateTaskProjects).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			added: 0,
			skippedExisting: 1,
			errors: 0,
		});
	});

	it("continues after update errors and reports them", async () => {
		const error = new Error("write failed");
		const onAddError = jest.fn();

		const result = await applyTaskEditSubtaskChanges({
			parentTaskFile: parentFile,
			initialSubtaskFiles: [],
			selectedSubtaskFiles: [{ path: "Tasks/fail.md" }],
			getTaskInfo: async (path) => createTask(path, []),
			buildProjectReference: () => "[[Tasks/Parent]]",
			updateTaskProjects: jest.fn(async () => {
				throw error;
			}),
			onAddError,
		});

		expect(onAddError).toHaveBeenCalledWith(error, { path: "Tasks/fail.md" });
		expect(result).toMatchObject({
			added: 0,
			errors: 1,
			nextInitialSubtaskFiles: [{ path: "Tasks/fail.md" }],
		});
	});

	it("removes generated and legacy parent references from project lists", () => {
		expect(
			getTaskEditSubtaskProjectRemovalUpdate(
				["[[Tasks/Parent]]", "[[Parent]]", "[[Other]]", 42],
				"[[Tasks/Parent]]",
				"[[Parent]]"
			)
		).toEqual(["[[Other]]"]);
	});
});
