/**
 * Bulk task creation engine.
 * Creates multiple tasks from Bases data items with progress tracking and duplicate detection.
 */

import { Notice, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskCreationData, TaskInfo } from "../types";
import { BasesDataItem } from "../bases/helpers";
import { DuplicateDetector, DuplicateCheckResult } from "./duplicate-detector";

export interface BulkCreationOptions {
	/** Skip items that already have tasks linked to them */
	skipExisting: boolean;
	/** Add source note as project link in created tasks */
	useParentAsProject: boolean;
	/** Callback for progress updates */
	onProgress?: (current: number, total: number, status: string) => void;
	/** Paths to person or group notes to assign all tasks to (will be formatted as wikilinks) */
	assignees?: string[];
	/** Bulk due date to apply to all tasks (YYYY-MM-DD) */
	dueDate?: string;
	/** Bulk scheduled date to apply to all tasks (YYYY-MM-DD) */
	scheduledDate?: string;
	/** Bulk status to apply to all tasks */
	status?: string;
	/** Bulk priority to apply to all tasks */
	priority?: string;
	/** Bulk reminders to apply to all tasks */
	reminders?: Array<{ id?: string; type: string; relatedTo?: string; offset?: string; absoluteTime?: string; description?: string }>;
	/** Custom frontmatter properties to apply to all tasks */
	customFrontmatter?: Record<string, any>;
	/** Per-view field mapping from a .base file (ADR-011). Passed through to TaskService. */
	viewFieldMapping?: import("../identity/BaseIdentityService").ViewFieldMapping;
	/** Source base ID for provenance tracking (ADR-011). */
	sourceBaseId?: string;
	/** Source view ID for provenance tracking (ADR-011). */
	sourceViewId?: string;
}

export interface BulkCreationResult {
	/** Number of tasks successfully created */
	created: number;
	/** Number of items skipped (already had tasks) */
	skipped: number;
	/** Number of items that failed to create */
	failed: number;
	/** Error messages for failed items */
	errors: string[];
	/** Paths of created task files */
	createdPaths: string[];
}

/**
 * Extract a suitable task title from a Bases data item.
 */
function extractTitle(item: BasesDataItem): string {
	// Try various sources for the title
	const props = item.properties || {};

	// Check for explicit title property
	if (props.title && typeof props.title === "string") {
		return props.title;
	}

	// Check for file basename
	if (item.file?.basename) {
		return item.file.basename;
	}

	// Check for name property
	if (item.name) {
		return item.name;
	}

	// Extract from path
	if (item.path) {
		const basename = item.path.split("/").pop() || item.path;
		return basename.replace(/\.md$/i, "");
	}

	return "Untitled task";
}

/**
 * Generate a wiki-link to a source note.
 */
function generateProjectLink(sourcePath: string, app: any): string {
	const file = app.vault.getAbstractFileByPath(sourcePath);
	if (file instanceof TFile) {
		return app.fileManager.generateMarkdownLink(file, file.path);
	}
	// Fallback: create wiki-link from path
	const basename = sourcePath.split("/").pop()?.replace(/\.md$/i, "") || sourcePath;
	return `[[${basename}]]`;
}

/**
 * BulkTaskEngine handles creating multiple tasks from Bases data items.
 */
export class BulkTaskEngine {
	private duplicateDetector: DuplicateDetector;

	constructor(private plugin: TaskNotesPlugin) {
		this.duplicateDetector = new DuplicateDetector(plugin);
	}

	/**
	 * Create tasks for all provided Bases data items.
	 * Uses parallel execution with concurrency limit for better performance.
	 *
	 * @param items - Array of Bases data items to create tasks from
	 * @param options - Creation options
	 * @returns Result object with counts and error information
	 */
	async createTasks(
		items: BasesDataItem[],
		options: BulkCreationOptions
	): Promise<BulkCreationResult> {
		const result: BulkCreationResult = {
			created: 0,
			skipped: 0,
			failed: 0,
			errors: [],
			createdPaths: [],
		};

		if (items.length === 0) {
			return result;
		}

		// Check for duplicates if skipExisting is enabled
		let duplicateCheck: DuplicateCheckResult | null = null;
		if (options.skipExisting) {
			options.onProgress?.(0, items.length, "Checking for existing tasks...");
			const sourcePaths = items.map((item) => item.path || "").filter(Boolean);
			duplicateCheck = await this.duplicateDetector.checkForDuplicates(sourcePaths);
		}

		// Filter items to create (excluding duplicates)
		const itemsToCreate: BasesDataItem[] = [];
		for (const item of items) {
			const sourcePath = item.path || "";
			if (options.skipExisting && duplicateCheck?.existingTaskPaths.has(sourcePath)) {
				result.skipped++;
			} else {
				itemsToCreate.push(item);
			}
		}

		const total = itemsToCreate.length;
		if (total === 0) {
			return result;
		}

		// Parallel execution with concurrency limit
		const CONCURRENCY_LIMIT = 5;
		let completed = 0;

		// Process in batches with concurrency limit
		for (let i = 0; i < itemsToCreate.length; i += CONCURRENCY_LIMIT) {
			const batch = itemsToCreate.slice(i, i + CONCURRENCY_LIMIT);

			const batchPromises = batch.map(async (item) => {
				const sourcePath = item.path || "";
				try {
					const taskFile = await this.createTaskForItem(item, options);
					return { success: true as const, path: taskFile?.path, sourcePath };
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					return { success: false as const, error: errorMsg, sourcePath };
				}
			});

			const batchResults = await Promise.all(batchPromises);

			// Process batch results
			for (const batchResult of batchResults) {
				completed++;
				options.onProgress?.(completed, total, `Creating task ${completed} of ${total}...`);

				if (batchResult.success && batchResult.path) {
					result.created++;
					result.createdPaths.push(batchResult.path);
				} else if (batchResult.success) {
					result.failed++;
					result.errors.push(`Failed to create task for: ${batchResult.sourcePath}`);
				} else {
					result.failed++;
					result.errors.push(`Error for ${batchResult.sourcePath}: ${batchResult.error}`);
				}
			}
		}

		return result;
	}

	/**
	 * Create a single task for a Bases data item.
	 */
	private async createTaskForItem(
		item: BasesDataItem,
		options: BulkCreationOptions
	): Promise<TFile | null> {
		const title = extractTitle(item);
		const sourcePath = item.path || "";
		const props = item.properties || {};

		// Build task creation data
		const taskData: TaskCreationData = {
			title,
			creationContext: "manual-creation",
		};

		// Add project link if requested
		if (options.useParentAsProject && sourcePath) {
			const projectLink = generateProjectLink(sourcePath, this.plugin.app);
			taskData.projects = [projectLink];
		}

		// Apply bulk values first, then source properties can override if present
		// Bulk values take priority (user explicitly set them in the modal)
		if (options.dueDate) {
			taskData.due = options.dueDate;
		} else if (props.due) {
			taskData.due = String(props.due);
		}

		if (options.scheduledDate) {
			taskData.scheduled = options.scheduledDate;
		} else if (props.scheduled) {
			taskData.scheduled = String(props.scheduled);
		}

		if (options.status) {
			taskData.status = options.status;
		}

		if (options.priority) {
			taskData.priority = options.priority;
		} else if (props.priority) {
			taskData.priority = String(props.priority);
		}

		if (props.contexts && Array.isArray(props.contexts)) {
			taskData.contexts = props.contexts.map(String);
		}

		// Apply bulk reminders if provided
		if (options.reminders && options.reminders.length > 0) {
			taskData.reminders = options.reminders.map(r => ({
				id: r.id || `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
				type: r.type as "relative" | "absolute",
				relatedTo: r.relatedTo,
				offset: r.offset,
				absoluteTime: r.absoluteTime,
				description: r.description,
			}));
		}

		// Apply custom frontmatter properties
		if (options.customFrontmatter) {
			taskData.customFrontmatter = {
				...taskData.customFrontmatter,
				...options.customFrontmatter,
			};
		}

		// Auto-set creator from device identity (if configured)
		// Route through customFrontmatter so it survives TaskService's typed field extraction
		if (this.plugin.userRegistry?.shouldAutoSetCreator()) {
			const creator = this.plugin.userRegistry.getCreatorValueForNewTask();
			if (creator) {
				const creatorField = this.plugin.userRegistry.getCreatorFieldName();
				taskData.customFrontmatter = {
					...taskData.customFrontmatter,
					[creatorField]: creator,
				};
			}
		}

		// Set assignees if provided
		// Route through customFrontmatter so it survives TaskService's typed field extraction
		if (options.assignees && options.assignees.length > 0) {
			const assigneeFieldName = this.plugin.settings.assigneeFieldName || "assignee";
			const assigneeLinks = options.assignees.map(path => this.formatAsWikilink(path));
			taskData.customFrontmatter = {
				...taskData.customFrontmatter,
				[assigneeFieldName]: assigneeLinks.length === 1 ? assigneeLinks[0] : assigneeLinks,
			};
		}

		// Pass per-view field mapping and provenance (ADR-011)
		if (options.viewFieldMapping) {
			taskData.viewFieldMapping = options.viewFieldMapping;
		}
		if (options.sourceBaseId) {
			taskData.sourceBaseId = options.sourceBaseId;
		}
		if (options.sourceViewId) {
			taskData.sourceViewId = options.sourceViewId;
		}

		// Create the task using TaskService
		const result = await this.plugin.taskService.createTask(taskData);
		return result.file;
	}

	/**
	 * Format a path as a wikilink.
	 */
	private formatAsWikilink(path: string): string {
		const filename = path.split("/").pop() || path;
		const linkText = filename.replace(/\.md$/, "");
		return `[[${linkText}]]`;
	}

	/**
	 * Pre-check items to determine how many will be created vs skipped.
	 *
	 * @param items - Array of Bases data items
	 * @param skipExisting - Whether to skip existing items
	 * @returns Object with counts of items to create and skip
	 */
	async preCheck(
		items: BasesDataItem[],
		skipExisting: boolean
	): Promise<{ toCreate: number; toSkip: number; existing: Set<string> }> {
		if (!skipExisting) {
			return { toCreate: items.length, toSkip: 0, existing: new Set() };
		}

		const sourcePaths = items.map((item) => item.path || "").filter(Boolean);
		const duplicateCheck = await this.duplicateDetector.checkForDuplicates(sourcePaths);

		const toSkip = duplicateCheck.existingTaskPaths.size;
		const toCreate = items.length - toSkip;

		return {
			toCreate,
			toSkip,
			existing: duplicateCheck.existingTaskPaths,
		};
	}
}
