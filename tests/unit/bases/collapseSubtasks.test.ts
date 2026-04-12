/**
 * collapseSubtasks: Hide subtasks from top-level Bases views
 *
 * When collapseSubtasks is enabled on a TaskList or Kanban view, tasks whose
 * `projects` field links to another task that is also in the current result set
 * are removed from the top-level rendering. They remain accessible via the
 * parent task's subtask expansion chevron.
 *
 * Key behavior:
 * - Subtasks whose parent is in the view are hidden from top-level
 * - Tasks linked to non-task project notes (not in the result set) are kept
 * - Tasks with no projects are always kept
 * - The parent task itself is never hidden
 * - expandedRelationshipFilterMode is forced to "show-all" so subtask
 *   expansion still displays the hidden subtasks
 */

import { describe, it, expect } from "@jest/globals";
import type { TaskInfo } from "../../../src/types";
import { parseLinkToPath } from "../../../src/utils/linkUtils";

/**
 * Standalone replica of BasesViewBase.filterSubtasksFromTopLevel() that
 * accepts a link resolver function instead of depending on the Obsidian
 * metadataCache. This lets us test the filtering logic in isolation.
 */
function filterSubtasksFromTopLevel(
	tasks: TaskInfo[],
	resolveLink: (linkPath: string, sourcePath: string) => string | null
): TaskInfo[] {
	const taskPathSet = new Set<string>();
	for (const task of tasks) {
		taskPathSet.add(task.path);
	}

	return tasks.filter((task) => {
		if (!task.projects || task.projects.length === 0) {
			return true;
		}

		for (const project of task.projects) {
			if (!project || typeof project !== "string") continue;

			const linkPath = parseLinkToPath(project);

			if (linkPath === project && !project.startsWith("[[")) {
				continue;
			}

			const resolvedPath = resolveLink(linkPath, task.path);

			if (resolvedPath && taskPathSet.has(resolvedPath)) {
				return false;
			}
		}

		return true;
	});
}

// ── Fixtures ──────────────────────────────────────────────────────────

const parentTask: TaskInfo = {
	path: "Tasks/Build App.md",
	title: "Build App",
	status: "in-progress",
	priority: "high",
};

const subtaskA: TaskInfo = {
	path: "Tasks/Design UI.md",
	title: "Design UI",
	status: "open",
	priority: "normal",
	projects: ["[[Build App]]"],
};

const subtaskB: TaskInfo = {
	path: "Tasks/Write Tests.md",
	title: "Write Tests",
	status: "open",
	priority: "normal",
	projects: ["[[Build App]]"],
};

const standaloneTask: TaskInfo = {
	path: "Tasks/Buy Groceries.md",
	title: "Buy Groceries",
	status: "open",
	priority: "low",
};

const taskLinkedToProjectNote: TaskInfo = {
	path: "Tasks/Research API.md",
	title: "Research API",
	status: "open",
	priority: "normal",
	projects: ["[[Project Alpha]]"],
};

const nestedSubtask: TaskInfo = {
	path: "Tasks/Write Unit Tests.md",
	title: "Write Unit Tests",
	status: "open",
	priority: "normal",
	projects: ["[[Write Tests]]"],
};

/**
 * Simple link resolver that maps wikilink basenames to known task paths.
 */
function mockResolveLink(knownFiles: Record<string, string>) {
	return (linkPath: string, _sourcePath: string): string | null => {
		return knownFiles[linkPath] ?? null;
	};
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("collapseSubtasks: filterSubtasksFromTopLevel", () => {
	const resolver = mockResolveLink({
		"Build App": "Tasks/Build App.md",
		"Write Tests": "Tasks/Write Tests.md",
		"Design UI": "Tasks/Design UI.md",
	});

	it("hides subtasks whose parent is in the result set", () => {
		const tasks = [parentTask, subtaskA, subtaskB, standaloneTask];
		const result = filterSubtasksFromTopLevel(tasks, resolver);

		const resultPaths = result.map((t) => t.path);
		expect(resultPaths).toContain(parentTask.path);
		expect(resultPaths).toContain(standaloneTask.path);
		expect(resultPaths).not.toContain(subtaskA.path);
		expect(resultPaths).not.toContain(subtaskB.path);
	});

	it("keeps tasks linked to project notes that are not in the result set", () => {
		const tasks = [parentTask, taskLinkedToProjectNote, standaloneTask];
		const result = filterSubtasksFromTopLevel(tasks, resolver);

		const resultPaths = result.map((t) => t.path);
		expect(resultPaths).toContain(taskLinkedToProjectNote.path);
		expect(result).toHaveLength(3);
	});

	it("keeps tasks with no projects field", () => {
		const tasks = [standaloneTask, parentTask];
		const result = filterSubtasksFromTopLevel(tasks, resolver);

		expect(result).toHaveLength(2);
	});

	it("keeps subtasks when their parent is NOT in the result set", () => {
		// If the parent is filtered out by another Bases filter (e.g., status filter),
		// the subtask should still show at the top level.
		const tasks = [subtaskA, standaloneTask];
		const result = filterSubtasksFromTopLevel(tasks, resolver);

		const resultPaths = result.map((t) => t.path);
		expect(resultPaths).toContain(subtaskA.path);
		expect(resultPaths).toContain(standaloneTask.path);
	});

	it("handles nested subtasks (grandchild hidden when parent is in set)", () => {
		// parent → subtaskB (Write Tests) → nestedSubtask (Write Unit Tests)
		const tasks = [parentTask, subtaskB, nestedSubtask];
		const result = filterSubtasksFromTopLevel(tasks, resolver);

		const resultPaths = result.map((t) => t.path);
		// parentTask stays (no projects)
		expect(resultPaths).toContain(parentTask.path);
		// subtaskB hidden (parent Build App is in set)
		expect(resultPaths).not.toContain(subtaskB.path);
		// nestedSubtask hidden (parent Write Tests is in set)
		expect(resultPaths).not.toContain(nestedSubtask.path);
	});

	it("does not hide the parent task itself", () => {
		const tasks = [parentTask, subtaskA];
		const result = filterSubtasksFromTopLevel(tasks, resolver);

		expect(result).toHaveLength(1);
		expect(result[0].path).toBe(parentTask.path);
	});

	it("returns all tasks when none have projects", () => {
		const tasks = [standaloneTask, parentTask];
		const result = filterSubtasksFromTopLevel(tasks, resolver);

		expect(result).toEqual(tasks);
	});

	it("handles empty task list", () => {
		const result = filterSubtasksFromTopLevel([], resolver);
		expect(result).toEqual([]);
	});

	it("handles tasks with unresolvable project links", () => {
		const taskWithBrokenLink: TaskInfo = {
			path: "Tasks/Orphan.md",
			title: "Orphan",
			status: "open",
			priority: "normal",
			projects: ["[[Nonexistent Parent]]"],
		};

		const tasks = [parentTask, taskWithBrokenLink];
		const result = filterSubtasksFromTopLevel(tasks, resolver);

		// Broken link can't resolve, so task is kept
		expect(result).toHaveLength(2);
		expect(result.map((t) => t.path)).toContain(taskWithBrokenLink.path);
	});

	it("handles tasks with multiple projects where only one is in the set", () => {
		const multiProjectTask: TaskInfo = {
			path: "Tasks/Multi Project.md",
			title: "Multi Project",
			status: "open",
			priority: "normal",
			projects: ["[[Project Alpha]]", "[[Build App]]"],
		};

		const tasks = [parentTask, multiProjectTask, standaloneTask];
		const result = filterSubtasksFromTopLevel(tasks, resolver);

		// Should be hidden because one of its projects (Build App) is in the set
		expect(result.map((t) => t.path)).not.toContain(multiProjectTask.path);
	});

	it("handles plain text in projects (not a link) — keeps the task", () => {
		const taskWithPlainText: TaskInfo = {
			path: "Tasks/Plain.md",
			title: "Plain",
			status: "open",
			priority: "normal",
			projects: ["some plain text"],
		};

		const tasks = [parentTask, taskWithPlainText];
		const result = filterSubtasksFromTopLevel(tasks, resolver);

		expect(result).toHaveLength(2);
	});
});
