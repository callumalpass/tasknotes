/**
 * Bulk edit engine.
 * Modifies frontmatter properties on existing task files.
 * Only writes fields the user explicitly set — blank/empty fields are left untouched.
 */

import { TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { BasesDataItem } from "../bases/helpers";
import { getCurrentTimestamp } from "../utils/dateUtils";
import { FIELD_OVERRIDE_PROPS } from "../utils/fieldOverrideUtils";

export interface BulkEditOptions {
	/** Status to set on all edited tasks */
	status?: string;
	/** Priority to set on all edited tasks */
	priority?: string;
	/** Due date to set (YYYY-MM-DD format) */
	dueDate?: string;
	/** Scheduled/start date to set (YYYY-MM-DD format) */
	scheduledDate?: string;
	/** Assignees to set (wikilink strings) */
	assignees?: string[];
	/** Reminders to set */
	reminders?: Array<{ id?: string; type: string; relatedTo?: string; offset?: string; absoluteTime?: string; description?: string }>;
	/** Custom frontmatter properties to apply */
	customFrontmatter?: Record<string, any>;
	/** Per-view field mapping from a .base file (ADR-011) */
	viewFieldMapping?: import("../identity/BaseIdentityService").ViewFieldMapping;
	/** Source base ID for provenance tracking (ADR-011) */
	sourceBaseId?: string;
	/** Source view ID for provenance tracking (ADR-011) */
	sourceViewId?: string;
	/** Column-to-property assignments: maps target frontmatter property → source column ID (e.g., "formula.nextDue") */
	columnAssignments?: Record<string, string>;
	/** Callback for progress updates */
	onProgress?: (current: number, total: number, status: string) => void;
}

export interface BulkEditResult {
	/** Number of tasks successfully edited */
	edited: number;
	/** Number of items skipped (not tasks or non-markdown) */
	skipped: number;
	/** Number of items that failed */
	failed: number;
	/** Error messages for failed items */
	errors: string[];
	/** Paths of edited task files */
	editedPaths: string[];
}

export interface EditPreCheckResult {
	/** Number of items that ARE tasks (will be edited) */
	toEdit: number;
	/** Number of items that are NOT tasks (will be skipped) */
	notTasks: number;
	/** Paths of non-task items */
	notTaskPaths: Set<string>;
	/** Non-markdown files that will be skipped */
	nonMarkdown: number;
	nonMarkdownPaths: Set<string>;
	/** Breakdown of non-markdown files by extension */
	fileTypeBreakdown: Map<string, string[]>;
}

/**
 * BulkEditEngine handles modifying frontmatter properties on existing task files.
 * Unlike BulkConvertEngine, this operates on files that are ALREADY tasks.
 * Only explicitly-set fields are written — blank/empty fields are left untouched.
 */
export class BulkEditEngine {
	constructor(private plugin: TaskNotesPlugin) {}

	/**
	 * Pre-check items to determine how many are tasks (editable) vs non-tasks (skipped).
	 * Inverse of BulkConvertEngine.preCheck().
	 */
	async preCheck(items: BasesDataItem[]): Promise<EditPreCheckResult> {
		const notTaskPaths = new Set<string>();
		const nonMarkdownPaths = new Set<string>();
		const fileTypeBreakdown = new Map<string, string[]>();

		this.plugin.debugLog.log("BulkEditEngine", "preCheck", {
			itemCount: items.length,
			itemPaths: items.map((item) => item.path || "(no path)"),
		});

		for (const item of items) {
			const sourcePath = item.path || "";
			if (!sourcePath) continue;

			const file = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
			if (!(file instanceof TFile)) continue;

			// Skip non-markdown files
			if (file.extension !== "md") {
				nonMarkdownPaths.add(sourcePath);
				const ext = file.extension.toLowerCase();
				if (!fileTypeBreakdown.has(ext)) {
					fileTypeBreakdown.set(ext, []);
				}
				fileTypeBreakdown.get(ext)!.push(file.basename);
				continue;
			}

			// Check if NOT a task → will be skipped
			const metadata = this.plugin.app.metadataCache.getFileCache(file);
			const frontmatter = metadata?.frontmatter;
			if (!frontmatter || !this.plugin.cacheManager.isTaskFile(frontmatter)) {
				notTaskPaths.add(sourcePath);
			}
		}

		const notTasks = notTaskPaths.size;
		const nonMarkdown = nonMarkdownPaths.size;
		const toEdit = items.length - notTasks - nonMarkdown;

		this.plugin.debugLog.log("BulkEditEngine", "preCheck result", {
			toEdit,
			notTasks,
			nonMarkdown,
			notTaskPaths: [...notTaskPaths],
			nonMarkdownPaths: [...nonMarkdownPaths],
			fileTypeBreakdown: Object.fromEntries(fileTypeBreakdown),
		});

		return { toEdit, notTasks, notTaskPaths, nonMarkdown, nonMarkdownPaths, fileTypeBreakdown };
	}

	/**
	 * Edit existing task files by modifying their frontmatter.
	 * Only applies fields that are explicitly set in options (non-null, non-empty).
	 */
	async editTasks(
		items: BasesDataItem[],
		options: BulkEditOptions
	): Promise<BulkEditResult> {
		const result: BulkEditResult = {
			edited: 0,
			skipped: 0,
			failed: 0,
			errors: [],
			editedPaths: [],
		};

		if (items.length === 0) {
			return result;
		}

		// Pre-check which are NOT tasks
		options.onProgress?.(0, items.length, "Checking task files...");
		const preCheck = await this.preCheck(items);

		// Filter to actionable items (skip non-markdown and non-tasks upfront)
		const actionableItems: typeof items = [];
		for (const item of items) {
			const sourcePath = item.path || "";
			if (!sourcePath) continue;
			if (preCheck.nonMarkdownPaths.has(sourcePath)) {
				this.plugin.debugLog.log("BulkEditEngine", `Skipping (non-markdown): ${sourcePath}`);
				result.skipped++;
				continue;
			}
			if (preCheck.notTaskPaths.has(sourcePath)) {
				this.plugin.debugLog.log("BulkEditEngine", `Skipping (not a task): ${sourcePath}`);
				result.skipped++;
				continue;
			}
			actionableItems.push(item);
		}

		// Process in parallel batches
		const CONCURRENCY_LIMIT = 5;
		let completed = 0;
		const actionableTotal = actionableItems.length;

		for (let i = 0; i < actionableTotal; i += CONCURRENCY_LIMIT) {
			const batch = actionableItems.slice(i, i + CONCURRENCY_LIMIT);

			const batchPromises = batch.map(async (item) => {
				const sourcePath = item.path || "";
				const file = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
				if (!(file instanceof TFile)) {
					return { success: false as const, error: `File not found: ${sourcePath}`, sourcePath };
				}
				try {
					await this.editSingleTask(file, options, item);
					return { success: true as const, sourcePath };
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					return { success: false as const, error: `Error for ${sourcePath}: ${errorMsg}`, sourcePath };
				}
			});

			const batchResults = await Promise.all(batchPromises);

			for (const batchResult of batchResults) {
				completed++;
				if (batchResult.success) {
					result.edited++;
					result.editedPaths.push(batchResult.sourcePath);
				} else {
					result.failed++;
					result.errors.push(batchResult.error);
				}
			}

			options.onProgress?.(completed, actionableTotal, `Editing ${completed} of ${actionableTotal}...`);
		}

		return result;
	}

	/**
	 * Edit a single task file by modifying its frontmatter.
	 * Only writes fields that are explicitly set — unlike Convert, this OVERWRITES existing values.
	 */
	private async editSingleTask(file: TFile, options: BulkEditOptions, item?: any): Promise<void> {
		const settings = this.plugin.settings;
		const fieldMapper = this.plugin.fieldMapper;

		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			// Apply status if specified
			if (options.status) {
				const statusField = fieldMapper.toUserField("status");
				frontmatter[statusField] = options.status;
			}

			// Apply priority if specified
			if (options.priority) {
				const priorityField = fieldMapper.toUserField("priority");
				frontmatter[priorityField] = options.priority;
			}

			// Apply due date if specified
			if (options.dueDate) {
				const dueField = fieldMapper.toUserField("due");
				frontmatter[dueField] = options.dueDate;
			}

			// Apply scheduled date if specified
			if (options.scheduledDate) {
				const scheduledField = fieldMapper.toUserField("scheduled");
				frontmatter[scheduledField] = options.scheduledDate;
			}

			// Apply assignees if specified
			if (options.assignees && options.assignees.length > 0) {
				const assigneeField = settings.assigneeFieldName || "assignee";
				frontmatter[assigneeField] = options.assignees.length === 1
					? options.assignees[0]
					: options.assignees;
			}

			// Apply reminders if specified
			if (options.reminders && options.reminders.length > 0) {
				const remindersField = fieldMapper.toUserField("reminders");
				frontmatter[remindersField] = options.reminders.map(r => ({
					id: r.id || `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
					type: r.type,
					relatedTo: r.relatedTo,
					offset: r.offset,
					absoluteTime: r.absoluteTime,
					description: r.description,
				}));
			}

			// Apply custom frontmatter properties
			if (options.customFrontmatter) {
				for (const [key, value] of Object.entries(options.customFrontmatter)) {
					if (value !== null && value !== undefined && value !== "") {
						frontmatter[key] = value;
					}
				}
			}

			// Apply per-view field mapping (ADR-011)
			if (options.viewFieldMapping) {
				const mapping = options.viewFieldMapping;
				const fieldMappingEntries: Array<{
					viewKey: keyof typeof mapping;
					fieldMappingKey: "due" | "scheduled" | "completedDate" | "dateCreated";
					trackingProp: string;
				}> = [
					{ viewKey: "due", fieldMappingKey: "due", trackingProp: FIELD_OVERRIDE_PROPS.due },
					{ viewKey: "scheduled", fieldMappingKey: "scheduled", trackingProp: FIELD_OVERRIDE_PROPS.scheduled },
					{ viewKey: "completedDate", fieldMappingKey: "completedDate", trackingProp: FIELD_OVERRIDE_PROPS.completedDate },
					{ viewKey: "dateCreated", fieldMappingKey: "dateCreated", trackingProp: FIELD_OVERRIDE_PROPS.dateCreated },
				];

				for (const { viewKey, fieldMappingKey, trackingProp } of fieldMappingEntries) {
					const customPropName = mapping[viewKey];
					if (!customPropName?.trim()) continue;
					const globalPropName = fieldMapper.toUserField(fieldMappingKey);
					if (customPropName === globalPropName) continue;

					const hasGlobalValue = frontmatter[globalPropName] !== undefined;
					if (hasGlobalValue) {
						frontmatter[customPropName] = frontmatter[globalPropName];
						delete frontmatter[globalPropName];
					}
					if (hasGlobalValue || frontmatter[customPropName] !== undefined) {
						frontmatter[trackingProp] = customPropName;
					}
				}

				// Handle assignee field mapping
				if (mapping.assignee?.trim()) {
					const globalAssigneeProp = settings.assigneeFieldName || "assignee";
					if (mapping.assignee !== globalAssigneeProp) {
						const hasAssigneeValue = frontmatter[globalAssigneeProp] !== undefined;
						if (hasAssigneeValue) {
							frontmatter[mapping.assignee] = frontmatter[globalAssigneeProp];
							delete frontmatter[globalAssigneeProp];
						}
						if (hasAssigneeValue || frontmatter[mapping.assignee] !== undefined) {
							frontmatter[FIELD_OVERRIDE_PROPS.assignee] = mapping.assignee;
						}
					}
				}
			}

			// Write provenance tracking (ADR-011)
			if (this.plugin.settings.baseIdentityTrackSourceView) {
				if (options.sourceBaseId) {
					frontmatter["tnSourceBaseId"] = options.sourceBaseId;
				}
				if (options.sourceViewId) {
					frontmatter["tnSourceViewId"] = options.sourceViewId;
				}
			}

			// Apply column assignments: read value from Bases column → write to frontmatter property
			if (options.columnAssignments && item?.basesData) {
				for (const [targetProp, sourceColumnId] of Object.entries(options.columnAssignments)) {
					try {
						const rawValue = item.basesData.getValue(sourceColumnId);
						const nativeValue = this.convertBasesValueToNative(rawValue);
						if (nativeValue !== null && nativeValue !== undefined) {
							frontmatter[targetProp] = nativeValue;
						}
					} catch {
						// Skip — column may not exist for this item
					}
				}
			}

			// Always update dateModified
			const dateModifiedField = fieldMapper.toUserField("dateModified");
			frontmatter[dateModifiedField] = getCurrentTimestamp();
		});

		// Wait for metadata cache to index the changes
		if (this.plugin.cacheManager.waitForFreshTaskData) {
			await this.plugin.cacheManager.waitForFreshTaskData(file);
		}
	}

	/** Convert a Bases Value object to a native JS value suitable for YAML frontmatter. */
	private convertBasesValueToNative(value: any): any {
		if (value == null || value.constructor?.name === "NullValue") return null;
		// DateValue — format as YYYY-MM-DD
		if (value.constructor?.name === "DateValue" || value instanceof Date) {
			const d = value instanceof Date ? value : value.value;
			if (d instanceof Date && !isNaN(d.getTime())) {
				return d.toISOString().slice(0, 10);
			}
			return String(value);
		}
		// ListValue — convert each element
		if (value.constructor?.name === "ListValue" || Array.isArray(value)) {
			const arr = Array.isArray(value) ? value : (value.value || []);
			return arr.map((v: any) => this.convertBasesValueToNative(v));
		}
		// PrimitiveValue (string, number, boolean)
		if (value.value !== undefined) return value.value;
		// FileValue — return as wikilink
		if (value.constructor?.name === "FileValue" && value.path) {
			const basename = value.path.replace(/\.md$/, "").split("/").pop();
			return `[[${basename}]]`;
		}
		// Already native
		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
			return value;
		}
		return String(value);
	}
}
