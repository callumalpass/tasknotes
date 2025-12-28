/* eslint-disable no-console, @typescript-eslint/no-non-null-assertion */
import { TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";
import { parseLinkToPath } from "../utils/linkUtils";

export class ProjectSubtasksService {
	private plugin: TaskNotesPlugin;

	// Pre-computed reverse index: taskPath -> isUsedAsProject
	private projectIndex = new Map<string, boolean>();
	private indexLastBuilt = 0;
	private cachedBasesSortRules: { property: string; direction: string }[] = [];
	private readonly INDEX_TTL = 30000; // Rebuild index every 30 seconds

	// Performance stats (kept for monitoring)
	private stats = {
		indexBuilds: 0,
		indexHits: 0,
		indexMisses: 0,
	};

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Get all files that link to a specific project using native resolvedLinks API
	 * resolvedLinks format: Record<sourcePath, Record<targetPath, linkCount>>
	 */
	private getFilesLinkingToProject(projectPath: string): string[] {
		const resolvedLinks = this.plugin.app.metadataCache.resolvedLinks;
		const linkingSources: string[] = [];

		// Iterate through all source files and their targets
		for (const [sourcePath, targets] of Object.entries(resolvedLinks)) {
			// Check if this source file links to our project
			if (targets && targets[projectPath] > 0) {
				linkingSources.push(sourcePath);
			}
		}

		return linkingSources;
	}

	/**
	 * Check for unresolved project references (broken links)
	 * Useful for debugging and maintenance
	 */
	private getUnresolvedProjectReferences(taskPath: string): string[] {
		const unresolvedLinks = this.plugin.app.metadataCache.unresolvedLinks;
		const taskUnresolvedLinks = unresolvedLinks[taskPath];

		if (!taskUnresolvedLinks) return [];

		// Filter for potential project references
		return Object.keys(taskUnresolvedLinks).filter((linkText) => {
			// Could be a project reference if it matches common patterns
			return !linkText.includes("#") && !linkText.includes("|");
		});
	}

	/**
	 * Get all tasks that reference this file as a project (uses native resolvedLinks API)
	 */
	async getTasksLinkedToProject(projectFile: TFile): Promise<TaskInfo[]> {
		try {
			const linkingSources = this.getFilesLinkingToProject(projectFile.path);
			const linkedTasks: TaskInfo[] = [];

			for (const sourcePath of linkingSources) {
				// Check if this source file is a task with project references
				const taskInfo = await this.plugin.cacheManager.getTaskInfo(sourcePath);
				if (
					taskInfo &&
					(await this.isLinkFromProjectsField(sourcePath, projectFile.path))
				) {
					linkedTasks.push(taskInfo);
				}
			}

			return linkedTasks;
		} catch (error) {
			console.error("Error getting tasks linked to project:", error);
			return [];
		}
	}

	/**
	 * Check if a task is used as a project (i.e., referenced by other tasks)
	 */
	async isTaskUsedAsProject(taskPath: string): Promise<boolean> {
		// Use sync method for consistency and performance
		return this.isTaskUsedAsProjectSync(taskPath);
	}

	/**
	 * Check if a link from source to target comes from the projects field
	 */
	private async isLinkFromProjectsField(
		sourceFilePath: string,
		targetFilePath: string
	): Promise<boolean> {
		try {
			const sourceFile = this.plugin.app.vault.getAbstractFileByPath(sourceFilePath);
			if (!(sourceFile instanceof TFile)) return false;

			const metadata = this.plugin.app.metadataCache.getFileCache(sourceFile);

			// Use the user's configured field mapping for projects
			const projectsFieldName = this.plugin.fieldMapper.toUserField("projects");
			if (!metadata?.frontmatter?.[projectsFieldName]) return false;

			const projects = metadata.frontmatter[projectsFieldName];
			if (!Array.isArray(projects)) return false;

			// Check if any project reference resolves to our target
			for (const project of projects) {
				if (!project || typeof project !== "string") continue;

				// Parse the link to extract the path (handles both wikilinks and markdown links)
				const linkPath = parseLinkToPath(project);

				// Skip if not a link format
				if (linkPath === project && !project.startsWith("[[")) {
					continue; // Plain text, not a link
				}

				// Resolve the link to get the actual file
				const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
					linkPath,
					sourceFilePath
				);

				if (resolvedFile && resolvedFile.path === targetFilePath) {
					return true;
				}
			}

			return false;
		} catch (error) {
			console.error("Error checking if link is from projects field:", error);
			return false;
		}
	}

	/**
	 * Get project status using pre-computed reverse index (much faster than scanning all files)
	 */
	isTaskUsedAsProjectSync(taskPath: string): boolean {
		this.ensureIndexBuilt();

		if (this.projectIndex.has(taskPath)) {
			this.stats.indexHits++;
			return this.projectIndex.get(taskPath)!;
		}

		this.stats.indexMisses++;
		return false; // Not in index = not a project
	}

	/**
	 * Build reverse index of all project files (one scan instead of per-task scans)
	 */
	private buildProjectIndex(): void {
		const startTime = Date.now();
		this.projectIndex.clear();
		this.stats.indexBuilds++;

		try {
			const resolvedLinks = this.plugin.app.metadataCache.resolvedLinks;
			const projectPaths = new Set<string>();

			// Single pass through all resolved links to find project targets
			for (const [sourcePath, targets] of Object.entries(resolvedLinks)) {
				if (!targets) continue;

				// Check if source has projects frontmatter
				const metadata = this.plugin.app.metadataCache.getCache(sourcePath);

				// Validate that the source file is actually a task (issue #953)
				// Only tasks should be able to create project relationships
				if (!metadata?.frontmatter) continue;
				if (!this.plugin.cacheManager.isTaskFile(metadata.frontmatter)) continue;

				// Use the user's configured field mapping for projects
				const projectsFieldName = this.plugin.fieldMapper.toUserField("projects");
				const projects = metadata.frontmatter[projectsFieldName];

				if (!Array.isArray(projects)) continue;

				// Check if any project reference resolves to our target
				for (const project of projects) {
					if (!project || typeof project !== "string") continue;

					// Parse the link to extract the path (handles both wikilinks and markdown links)
					const linkPath = parseLinkToPath(project);

					// Skip if not a link format
					if (linkPath === project && !project.startsWith("[[")) {
						continue; // Plain text, not a link
					}

					// Resolve the link to get the actual file
					const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
						linkPath,
						sourcePath
					);
					// After line 207:

					if (resolvedFile) {
						projectPaths.add(resolvedFile.path);
					}
				}
			}

			// Build the reverse index
			for (const projectPath of projectPaths) {
				this.projectIndex.set(projectPath, true);
			}

			this.indexLastBuilt = Date.now();
			const duration = Date.now() - startTime;
			console.log(
				`[ProjectSubtasksService] Built project index: ${this.projectIndex.size} projects from ${Object.keys(resolvedLinks).length} files in ${duration}ms`
			);
		} catch (error) {
			console.error("Error building project index:", error);
		}
	}

	/**
	 * Ensure index is fresh (rebuild if needed)
	 */
	private ensureIndexBuilt(): void {
		const now = Date.now();
		if (now - this.indexLastBuilt > this.INDEX_TTL) {
			this.buildProjectIndex();
		}
	}

	/**
	 * Invalidate the cached project index so the next lookup rebuilds it.
	 */
	invalidateIndex(): void {
		this.projectIndex.clear();
		this.indexLastBuilt = 0;
	}

	/**
	 * Cleanup when service is destroyed
	 */
	destroy(): void {
		// Clear index and reset stats
		this.projectIndex.clear();
		this.stats = {
			indexBuilds: 0,
			indexHits: 0,
			indexMisses: 0,
		};
	}

	/**
	 * Sort tasks using the active Bases view sort config (if available),
	 * otherwise fall back to the legacy priority/status/due/title ordering.
	 */
	sortTasks(tasks: TaskInfo[]): TaskInfo[] {
		const sortRules = this.getActiveBasesSortRules();
		if (sortRules.length > 0) {
			return tasks.sort((a, b) => {
				for (const rule of sortRules) {
					const direction = (rule.direction || "ASC").toUpperCase() === "DESC" ? -1 : 1;
					const prop = rule.property;

					const result = this.compareByProperty(a, b, prop);
					if (result !== 0) return result * direction;
				}

				// Fallback to legacy ordering if all sort keys are equal
				return this.compareLegacy(a, b);
			});
		}

		// Legacy sort
		console.debug("[ProjectSubtasksService] No Bases sort rules found, using legacy subtask sort", {
			activeViewType: this.plugin.app.workspace.activeLeaf?.view?.getViewType?.(),
		});
		return tasks.sort((a, b) => {
			return this.compareLegacy(a, b);
		});
	}

	/**
	 * Returns true when Bases sort rules indicate manual column ranking.
	 */
	isManualSortEnabled(): boolean {
		const sortRules = this.getActiveBasesSortRules();
		if (sortRules.length !== 1) return false;
		const prop = sortRules[0]?.property;
		if (typeof prop !== "string") return false;
		return prop === "rankByColumn" || prop.endsWith(".rankByColumn");
	}

	/**
	 * Read sort rules from the active Bases view (Kanban or Task List).
	 */
	private getActiveBasesSortRules(): { property: string; direction: string }[] {
		try {
			const activeView: any = this.plugin.app.workspace.activeLeaf?.view;

			// Try multiple potential locations where Bases might expose getSort()
			const attempts: Array<{ label: string; getter: () => any }> = [
				{ label: "view.config.getSort", getter: () => activeView?.config?.getSort?.() },
				{ label: "view.getSort", getter: () => activeView?.getSort?.() },
				{ label: "view.controller.config.getSort", getter: () => activeView?.controller?.config?.getSort?.() },
				{ label: "view.query.config.getSort", getter: () => activeView?.query?.config?.getSort?.() },
				{ label: "view.config.sort", getter: () => activeView?.config?.sort },
				{ label: "view.sort", getter: () => activeView?.sort },
				{ label: "view.query.sort", getter: () => activeView?.query?.sort },
				{ label: "view.results.sort", getter: () => activeView?.results?.sort },
			];

			for (const attempt of attempts) {
				try {
					const sort = attempt.getter();
					if (Array.isArray(sort)) {
						console.debug("[ProjectSubtasksService] Using Bases sort from", attempt.label, sort);
						const normalized = sort
							.map((rule: any) => ({
								property: rule?.property,
								direction: rule?.direction || "ASC",
							}))
							.filter((rule) => !!rule.property);
						if (normalized.length > 0) {
							this.cachedBasesSortRules = normalized;
							return normalized;
						}
					}
				} catch {
					// ignore and try next
				}
			}

			// Fallback: inspect activeView.query?.sort or results?.sort since queryKeys includes 'query' and 'results'
			const scanForSortArray = (root: any, maxDepth = 3): { path: string; sort: any[] } | null => {
				if (!root || maxDepth < 0) return null;
				const queue: Array<{ value: any; path: string; depth: number }> = [{ value: root, path: "root", depth: 0 }];
				while (queue.length > 0) {
					const { value, path, depth } = queue.shift()!;
					if (Array.isArray(value) && value.every((v) => v && typeof v === "object" && "property" in v)) {
						return { path, sort: value };
					}
					if (value && typeof value === "object" && depth < maxDepth) {
						for (const [k, v] of Object.entries(value)) {
							queue.push({ value: v, path: `${path}.${k}`, depth: depth + 1 });
						}
					}
				}
				return null;
			};

			const scanned =
				scanForSortArray(activeView?.query) ||
				scanForSortArray(activeView?.results) ||
				scanForSortArray(activeView);
			if (scanned) {
				console.debug("[ProjectSubtasksService] Using Bases sort from scanned path", scanned.path, scanned.sort);
				const normalized = scanned.sort
					.map((rule: any) => ({
						property: rule?.property,
						direction: rule?.direction || "ASC",
					}))
					.filter((rule: any) => !!rule.property);
				if (normalized.length > 0) {
					this.cachedBasesSortRules = normalized;
					return normalized;
				}
			}

		} catch (error) {
			console.warn("[ProjectSubtasksService] Failed to read Bases sort config:", error);
		}

		// When focus is elsewhere (e.g., editing a note), fall back to the last known Bases sort
		if (this.cachedBasesSortRules.length > 0) {
			console.debug("[ProjectSubtasksService] Using cached Bases sort rules", this.cachedBasesSortRules);
			return this.cachedBasesSortRules;
		}

		return [];
	}

	/**
	 * Resolve a property value for sorting (supports core fields, user fields, and customProperties).
	 */
	private getPropertyValueForSort(task: TaskInfo, prop: string): any {
		const userFields = this.plugin.settings.userFields || [];

		const normalizeKey = (key: string) => {
			if (typeof key !== "string") return key;
			let k = key;
			// Strip common prefixes from Bases (task./note./file./formula./user:)
			k = k.replace(/^(task\.|note\.|file\.|formula\.|user:)/, "");
			if (k.includes(".")) k = k.split(".").pop() || k;
			return k;
		};

		const normalized = normalizeKey(prop);
		const matchedUserField = userFields.find(
			(f) => f.id === prop || f.key === prop || f.id === normalized || f.key === normalized
		);
		const userKey = matchedUserField?.key;

		const candidates = [
			prop,
			normalized,
			userKey,
			typeof normalized === "string" ? normalized.toLowerCase() : normalized,
			userKey ? userKey.toLowerCase() : undefined,
		].filter((c) => c !== undefined && c !== null);

		for (const candidate of candidates) {
			const core = (task as any)[candidate];
			if (core !== undefined) return core;
		}

		if (task.customProperties) {
			for (const [propKey, propValue] of Object.entries(task.customProperties)) {
				if (candidates.some((c) => typeof c === "string" && c === propKey)) {
					return propValue;
				}
				if (candidates.some((c) => typeof c === "string" && c === propKey.toLowerCase())) {
					return propValue;
				}
			}
		}

		return undefined;
	}

	/**
	 * Compare two tasks for a given property.
	 */
	private compareByProperty(a: TaskInfo, b: TaskInfo, prop: string): number {
		const toNumber = (val: any): number | undefined => {
			if (val === null || val === undefined) return undefined;
			const num = Number(val);
			return Number.isNaN(num) ? undefined : num;
		};

		const aVal = this.getPropertyValueForSort(a, prop);
		const bVal = this.getPropertyValueForSort(b, prop);

		switch (prop) {
			case "scheduled":
				return this.compareDates(aVal, bVal);
			case "due":
				return this.compareDates(aVal, bVal);
			case "priority":
				return (
					this.plugin.priorityManager.getPriorityWeight(aVal) -
					this.plugin.priorityManager.getPriorityWeight(bVal)
				);
			case "weight":
				return (toNumber(aVal) || 0) - (toNumber(bVal) || 0);
			case "status": {
				const aCompleted = this.plugin.statusManager.isCompletedStatus(aVal);
				const bCompleted = this.plugin.statusManager.isCompletedStatus(bVal);
				if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
				return 0;
			}
			case "title":
				return (aVal || "").localeCompare(bVal || "");
			default: {
				// Generic fallback for other properties, including customProperties
				if (aVal == null && bVal == null) return 0;
				if (aVal == null) return 1;
				if (bVal == null) return -1;
				if (typeof aVal === "number" && typeof bVal === "number") {
					return aVal - bVal;
				}
				if (typeof aVal === "string" && typeof bVal === "string") {
					return aVal.localeCompare(bVal);
				}
				return 0;
			}
		}
	}

	private compareDates(a?: string, b?: string): number {
		if (!a && !b) return 0;
		if (!a) return 1;
		if (!b) return -1;
		return new Date(a).getTime() - new Date(b).getTime();
	}

	private compareLegacy(a: TaskInfo, b: TaskInfo): number {
		// First sort by completion status (incomplete first)
		const aCompleted = this.plugin.statusManager.isCompletedStatus(a.status);
		const bCompleted = this.plugin.statusManager.isCompletedStatus(b.status);

		if (aCompleted !== bCompleted) {
			return aCompleted ? 1 : -1;
		}

		// Then sort by priority
		const aPriorityWeight = this.plugin.priorityManager.getPriorityWeight(a.priority);
		const bPriorityWeight = this.plugin.priorityManager.getPriorityWeight(b.priority);

		if (aPriorityWeight !== bPriorityWeight) {
			return bPriorityWeight - aPriorityWeight; // Higher priority first
		}

		// Then sort by due date (earliest first)
		if (a.due && b.due) {
			return new Date(a.due).getTime() - new Date(b.due).getTime();
		} else if (a.due) {
			return -1; // Tasks with due dates come first
		} else if (b.due) {
			return 1;
		}

		// Finally sort by title
		return a.title.localeCompare(b.title);
	}
}
