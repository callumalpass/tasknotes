import type { TaskDependency, TaskInfo } from "../../types";
import {
	DEFAULT_DEPENDENCY_RELTYPE,
	normalizeDependencyEntry,
} from "../../utils/dependencyUtils";

export type BlockingRelationshipAction = "add" | "remove";

export interface BlockingRelationshipPathChanges {
	uniqueAdditions: string[];
	uniqueRemovals: string[];
}

export interface ComputeBlockedByUpdateInput {
	blockedTask: Pick<TaskInfo, "path" | "blockedBy">;
	blockingTaskPath: string;
	action: BlockingRelationshipAction;
	rawEntry?: TaskDependency | string;
	useFrontmatterMarkdownLinks?: boolean;
	resolveDependencyPath: (
		sourcePath: string,
		entry: TaskDependency | string
	) => string | null;
	formatDependencyLink: (
		sourcePath: string,
		targetPath: string,
		useMarkdownLinks?: boolean
	) => string;
}

export function buildBlockingRelationshipPathChanges(
	addedBlockedTaskPaths: string[],
	removedBlockedTaskPaths: string[]
): BlockingRelationshipPathChanges {
	return {
		uniqueAdditions: Array.from(new Set(addedBlockedTaskPaths)),
		uniqueRemovals: Array.from(new Set(removedBlockedTaskPaths)),
	};
}

export function computeBlockedByUpdate({
	blockedTask,
	blockingTaskPath,
	action,
	rawEntry,
	useFrontmatterMarkdownLinks,
	resolveDependencyPath,
	formatDependencyLink,
}: ComputeBlockedByUpdateInput): TaskDependency[] | null {
	const existing = Array.isArray(blockedTask.blockedBy)
		? blockedTask.blockedBy
				.map((entry) => normalizeDependencyEntry(entry))
				.filter((entry): entry is TaskDependency => !!entry)
		: [];

	if (existing.length === 0 && action === "remove") {
		return null;
	}

	let modified = false;
	let hasExistingEntry = false;
	const result: TaskDependency[] = [];

	for (const entry of existing) {
		const resolvedPath = resolveDependencyPath(blockedTask.path, entry);
		if (resolvedPath === blockingTaskPath) {
			hasExistingEntry = true;
			if (action === "remove") {
				modified = true;
				continue;
			}
		}
		result.push(entry);
	}

	if (action === "add" && !hasExistingEntry) {
		const normalizedIncoming = rawEntry ? normalizeDependencyEntry(rawEntry) : null;
		const dependency: TaskDependency = {
			uid: formatDependencyLink(
				blockedTask.path,
				blockingTaskPath,
				useFrontmatterMarkdownLinks
			),
			reltype: normalizedIncoming?.reltype ?? DEFAULT_DEPENDENCY_RELTYPE,
		};
		if (normalizedIncoming?.gap) {
			dependency.gap = normalizedIncoming.gap;
		}
		result.push(dependency);
		modified = true;
	}

	return modified ? result : null;
}

export function buildBlockedByTaskUpdate(
	updatedBlockedBy: TaskDependency[] | null
): Pick<Partial<TaskInfo>, "blockedBy"> | null {
	if (updatedBlockedBy === null) {
		return null;
	}

	return {
		blockedBy: updatedBlockedBy.length > 0 ? updatedBlockedBy : undefined,
	};
}
