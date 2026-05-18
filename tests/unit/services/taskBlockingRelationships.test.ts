import {
	buildBlockedByTaskUpdate,
	buildBlockingRelationshipPathChanges,
	computeBlockedByUpdate,
} from "../../../src/services/task-service/taskBlockingRelationships";
import type { TaskDependency, TaskInfo } from "../../../src/types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Blocked task",
		status: "open",
		priority: "normal",
		path: "TaskNotes/Blocked task.md",
		archived: false,
		...overrides,
	} as TaskInfo;
}

function createContext() {
	const resolvedPaths = new Map<string, string>();
	const resolveDependencyPath = jest.fn((sourcePath: string, entry: TaskDependency | string) => {
		const uid = typeof entry === "string" ? entry : entry.uid;
		return resolvedPaths.get(`${sourcePath}:${uid}`) ?? null;
	});
	const formatDependencyLink = jest.fn(
		(_sourcePath: string, targetPath: string, useMarkdownLinks?: boolean) =>
			useMarkdownLinks ? `[${targetPath}](obsidian://open)` : `[[${targetPath}]]`
	);

	return {
		resolvedPaths,
		resolveDependencyPath,
		formatDependencyLink,
	};
}

describe("taskBlockingRelationships", () => {
	it("deduplicates added and removed blocking relationship paths", () => {
		expect(
			buildBlockingRelationshipPathChanges(
				["TaskNotes/A.md", "TaskNotes/A.md", "TaskNotes/B.md"],
				["TaskNotes/C.md", "TaskNotes/C.md"]
			)
		).toEqual({
			uniqueAdditions: ["TaskNotes/A.md", "TaskNotes/B.md"],
			uniqueRemovals: ["TaskNotes/C.md"],
		});
	});

	it("removes the matching blocking dependency while preserving other entries", () => {
		const context = createContext();
		context.resolvedPaths.set("TaskNotes/Blocked task.md:TaskNotes/Blocker.md", "TaskNotes/Blocker.md");

		const updated = computeBlockedByUpdate({
			blockedTask: createTask({
				blockedBy: [
					{ uid: "TaskNotes/Blocker.md", reltype: "FINISHTOSTART" },
					{ uid: "TaskNotes/Other.md", reltype: "STARTTOSTART", gap: "P1D" },
				],
			}),
			blockingTaskPath: "TaskNotes/Blocker.md",
			action: "remove",
			resolveDependencyPath: context.resolveDependencyPath,
			formatDependencyLink: context.formatDependencyLink,
		});

		expect(updated).toEqual([
			{ uid: "TaskNotes/Other.md", reltype: "STARTTOSTART", gap: "P1D" },
		]);
	});

	it("returns an undefined blockedBy update when removing the last dependency", () => {
		const context = createContext();
		context.resolvedPaths.set("TaskNotes/Blocked task.md:TaskNotes/Blocker.md", "TaskNotes/Blocker.md");

		const updated = computeBlockedByUpdate({
			blockedTask: createTask({
				blockedBy: [{ uid: "TaskNotes/Blocker.md", reltype: "FINISHTOSTART" }],
			}),
			blockingTaskPath: "TaskNotes/Blocker.md",
			action: "remove",
			resolveDependencyPath: context.resolveDependencyPath,
			formatDependencyLink: context.formatDependencyLink,
		});

		expect(buildBlockedByTaskUpdate(updated)).toEqual({ blockedBy: undefined });
	});

	it("returns null when removing a non-matching dependency", () => {
		const context = createContext();
		context.resolvedPaths.set("TaskNotes/Blocked task.md:TaskNotes/Other.md", "TaskNotes/Other.md");

		const updated = computeBlockedByUpdate({
			blockedTask: createTask({
				blockedBy: [{ uid: "TaskNotes/Other.md", reltype: "FINISHTOSTART" }],
			}),
			blockingTaskPath: "TaskNotes/Blocker.md",
			action: "remove",
			resolveDependencyPath: context.resolveDependencyPath,
			formatDependencyLink: context.formatDependencyLink,
		});

		expect(updated).toBeNull();
		expect(buildBlockedByTaskUpdate(updated)).toBeNull();
	});

	it("does not add a duplicate dependency when an existing entry resolves to the blocker", () => {
		const context = createContext();
		context.resolvedPaths.set("TaskNotes/Blocked task.md:Existing blocker", "TaskNotes/Blocker.md");

		const updated = computeBlockedByUpdate({
			blockedTask: createTask({
				blockedBy: [{ uid: "Existing blocker", reltype: "FINISHTOSTART" }],
			}),
			blockingTaskPath: "TaskNotes/Blocker.md",
			action: "add",
			resolveDependencyPath: context.resolveDependencyPath,
			formatDependencyLink: context.formatDependencyLink,
		});

		expect(updated).toBeNull();
		expect(context.formatDependencyLink).not.toHaveBeenCalled();
	});

	it("adds a new dependency using the blocked task relative link and raw entry metadata", () => {
		const context = createContext();

		const updated = computeBlockedByUpdate({
			blockedTask: createTask({
				blockedBy: [{ uid: "TaskNotes/Other.md", reltype: "FINISHTOSTART" }],
			}),
			blockingTaskPath: "TaskNotes/Blocker.md",
			action: "add",
			rawEntry: { uid: "Ignored relative source", reltype: "STARTTOSTART", gap: "P2D" },
			useFrontmatterMarkdownLinks: false,
			resolveDependencyPath: context.resolveDependencyPath,
			formatDependencyLink: context.formatDependencyLink,
		});

		expect(updated).toEqual([
			{ uid: "TaskNotes/Other.md", reltype: "FINISHTOSTART" },
			{ uid: "[[TaskNotes/Blocker.md]]", reltype: "STARTTOSTART", gap: "P2D" },
		]);
		expect(context.formatDependencyLink).toHaveBeenCalledWith(
			"TaskNotes/Blocked task.md",
			"TaskNotes/Blocker.md",
			false
		);
	});

	it("defaults invalid raw entry relationship metadata when adding", () => {
		const context = createContext();

		const updated = computeBlockedByUpdate({
			blockedTask: createTask(),
			blockingTaskPath: "TaskNotes/Blocker.md",
			action: "add",
			rawEntry: { uid: "Bad relationship", reltype: "invalid" as TaskDependency["reltype"] },
			resolveDependencyPath: context.resolveDependencyPath,
			formatDependencyLink: context.formatDependencyLink,
		});

		expect(updated).toEqual([
			{ uid: "[[TaskNotes/Blocker.md]]", reltype: "FINISHTOSTART" },
		]);
	});
});
