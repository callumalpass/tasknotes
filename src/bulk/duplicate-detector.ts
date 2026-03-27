/**
 * Duplicate detection for bulk task creation.
 * Checks if tasks already exist that link to source notes via the `projects` field.
 */

import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";

export interface DuplicateCheckResult {
	/** Source paths that already have associated tasks */
	existingTaskPaths: Set<string>;
	/** Map from source path to existing task paths */
	sourceToTaskMap: Map<string, string[]>;
}

/**
 * Extracts the actual note path from a wiki-link or markdown link.
 * Handles formats like:
 * - [[Note Name]]
 * - [[path/to/Note Name]]
 * - [[Note Name|Display Text]]
 * - [Display](path/to/Note.md)
 */
function extractPathFromLink(link: string): string {
	if (!link) return "";

	// Handle wiki-links: [[Note Name]] or [[Note Name|alias]]
	const wikiMatch = link.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
	if (wikiMatch) {
		return wikiMatch[1].trim();
	}

	// Handle markdown links: [text](path)
	const mdMatch = link.match(/^\[.*?\]\(([^)]+)\)$/);
	if (mdMatch) {
		return mdMatch[1].trim();
	}

	// Already a plain path
	return link.trim();
}

/**
 * Normalize a path for comparison.
 * Removes .md extension and converts to lowercase.
 */
function normalizePath(path: string): string {
	return path.replace(/\.md$/i, "").toLowerCase();
}

/**
 * Check if a task's projects field links to a given source path.
 */
function taskLinksToSource(task: TaskInfo, sourcePath: string): boolean {
	if (!task.projects || task.projects.length === 0) return false;

	const normalizedSource = normalizePath(sourcePath);
	// Also check just the basename
	const sourceBasename = normalizedSource.split("/").pop() || normalizedSource;

	for (const project of task.projects) {
		const projectPath = extractPathFromLink(project);
		const normalizedProject = normalizePath(projectPath);
		const projectBasename = normalizedProject.split("/").pop() || normalizedProject;

		// Match if full paths match or basenames match
		if (
			normalizedProject === normalizedSource ||
			projectBasename === sourceBasename ||
			normalizedProject.endsWith("/" + sourceBasename) ||
			normalizedSource.endsWith("/" + projectBasename)
		) {
			return true;
		}
	}

	return false;
}

/**
 * DuplicateDetector class for checking if tasks already exist for source notes.
 */
export class DuplicateDetector {
	constructor(private plugin: TaskNotesPlugin) {}

	/**
	 * Check which source paths already have tasks linked to them.
	 *
	 * @param sourcePaths - Array of source note paths to check
	 * @returns DuplicateCheckResult with existing task information
	 */
	async checkForDuplicates(sourcePaths: string[]): Promise<DuplicateCheckResult> {
		const existingTaskPaths = new Set<string>();
		const sourceToTaskMap = new Map<string, string[]>();

		// Get all existing tasks
		const allTasks = await this.plugin.cacheManager.getAllTasks();

		// For each source path, check if any task links to it
		for (const sourcePath of sourcePaths) {
			const linkedTasks: string[] = [];

			for (const task of allTasks) {
				if (taskLinksToSource(task, sourcePath)) {
					linkedTasks.push(task.path);
				}
			}

			if (linkedTasks.length > 0) {
				existingTaskPaths.add(sourcePath);
				sourceToTaskMap.set(sourcePath, linkedTasks);
			}
		}

		return {
			existingTaskPaths,
			sourceToTaskMap,
		};
	}

	/**
	 * Check if a single source path already has a task linked to it.
	 *
	 * @param sourcePath - Source note path to check
	 * @returns true if a task already exists for this source
	 */
	async hasExistingTask(sourcePath: string): Promise<boolean> {
		const result = await this.checkForDuplicates([sourcePath]);
		return result.existingTaskPaths.has(sourcePath);
	}
}
