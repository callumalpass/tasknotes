import { describe, expect, it } from "@jest/globals";
import type { TaskInfo } from "../../../src/types";
import { filterTopLevelSubtasks, taskLinksToTaskInSet } from "../../../src/bases/topLevelSubtasks";

function task(path: string, projects?: string[]): TaskInfo {
	return {
		path,
		title: path.split("/").pop()?.replace(/\.md$/, "") ?? path,
		status: "open",
		projects,
	};
}

function resolver(links: Record<string, string>) {
	return (linkPath: string): { path: string } | null => {
		const resolvedPath = links[linkPath] ?? links[linkPath.replace(/\.md$/i, "")];
		return resolvedPath ? { path: resolvedPath } : null;
	};
}

describe("top-level subtask filtering", () => {
	const resolveProjectLink = resolver({
		"Build bean trellis": "Tasks/Build bean trellis.md",
		"Projects/Garden": "Projects/Garden.md",
		"Write Tests": "Tasks/Write Tests.md",
	});

	it("hides only tasks whose project link resolves to another task in the filtered set", () => {
		const parent = task("Tasks/Build bean trellis.md", ["[[Projects/Garden]]"]);
		const child = task("Tasks/Waterproof boards.md", [
			"[[Projects/Garden]]",
			"[[Build bean trellis]]",
		]);
		const projectTask = task("Tasks/Buy seeds.md", ["[[Projects/Garden]]"]);

		const result = filterTopLevelSubtasks([parent, child, projectTask], resolveProjectLink);

		expect(result.map((item) => item.path)).toEqual([
			"Tasks/Build bean trellis.md",
			"Tasks/Buy seeds.md",
		]);
	});

	it("keeps a child task when its parent task is not in the filtered set", () => {
		const child = task("Tasks/Waterproof boards.md", ["[[Build bean trellis]]"]);
		const unrelated = task("Tasks/Buy seeds.md", ["[[Projects/Garden]]"]);

		const result = filterTopLevelSubtasks([child, unrelated], resolveProjectLink);

		expect(result.map((item) => item.path)).toEqual([
			"Tasks/Waterproof boards.md",
			"Tasks/Buy seeds.md",
		]);
	});

	it("keeps tasks linked only to non-task project notes in the filtered set", () => {
		const projectLinkedTask = task("Tasks/Buy seeds.md", ["[[Projects/Garden]]"]);
		const directTask = task("Tasks/Sharpen tools.md");

		const result = filterTopLevelSubtasks(
			[projectLinkedTask, directTask],
			resolveProjectLink
		);

		expect(result).toEqual([projectLinkedTask, directTask]);
	});

	it("supports markdown project links and nested subtasks", () => {
		const parent = task("Tasks/Build bean trellis.md");
		const child = task("Tasks/Write Tests.md", ["[parent](Build%20bean%20trellis.md)"]);
		const grandchild = task("Tasks/Write Unit Tests.md", ["[[Write Tests]]"]);

		const result = filterTopLevelSubtasks(
			[parent, child, grandchild],
			resolver({
				"Build bean trellis.md": parent.path,
				"Write Tests": child.path,
			})
		);

		expect(result).toEqual([parent]);
	});

	it("ignores plain text and unresolved project values", () => {
		const taskPaths = new Set(["Tasks/Plain.md"]);

		expect(
			taskLinksToTaskInSet(
				task("Tasks/Plain.md", ["plain project", "[[Missing parent]]"]),
				taskPaths,
				() => null
			)
		).toBe(false);
	});
});
