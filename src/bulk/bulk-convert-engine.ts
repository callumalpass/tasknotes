/**
 * Bulk convert engine.
 * Converts existing notes into tasks by adding task metadata to their frontmatter in-place.
 * Does NOT create new files — modifies existing notes.
 */

import { TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { BasesDataItem } from "../bases/helpers";
import { getCurrentTimestamp } from "../utils/dateUtils";
import { FIELD_OVERRIDE_PROPS } from "../utils/fieldOverrideUtils";

export interface BulkConvertOptions {
	/** Apply default status, priority, and dateCreated to converted notes */
	applyDefaults: boolean;
	/** Link converted notes to their source .base file via projects field */
	linkToBase?: boolean;
	/** Path of the .base file to link to */
	baseFilePath?: string;
	/** Due date to set on all converted notes (YYYY-MM-DD format) */
	dueDate?: string;
	/** Scheduled/start date to set on all converted notes (YYYY-MM-DD format) */
	scheduledDate?: string;
	/** Bulk status to apply (overrides defaults) */
	status?: string;
	/** Bulk priority to apply (overrides defaults) */
	priority?: string;
	/** Bulk reminders to apply to all converted notes */
	reminders?: Array<{ id?: string; type: string; relatedTo?: string; offset?: string; absoluteTime?: string; description?: string }>;
	/** Custom frontmatter properties to apply to all converted notes */
	customFrontmatter?: Record<string, any>;
	/** Per-view field mapping from a .base file (ADR-011). Used when writing core fields. */
	viewFieldMapping?: import("../identity/BaseIdentityService").ViewFieldMapping;
	/** Source base ID for provenance tracking (ADR-011). */
	sourceBaseId?: string;
	/** Source view ID for provenance tracking (ADR-011). */
	sourceViewId?: string;
	/** Re-process files that are already tasks (apply mapping/custom props without re-identifying). */
	reapplyToExistingTasks?: boolean;
	/** Callback for progress updates */
	onProgress?: (current: number, total: number, status: string) => void;
}

export interface BulkConvertResult {
	/** Number of notes successfully converted */
	converted: number;
	/** Number of notes skipped (already tasks or non-markdown) */
	skipped: number;
	/** Number of notes that failed to convert */
	failed: number;
	/** Error messages for failed items */
	errors: string[];
	/** Paths of converted note files */
	convertedPaths: string[];
}

export interface ConvertPreCheckResult {
	toConvert: number;
	alreadyTasks: number;
	alreadyTaskPaths: Set<string>;
	/** Non-markdown files that will be skipped */
	nonMarkdown: number;
	nonMarkdownPaths: Set<string>;
	/** Breakdown of non-markdown files by extension: ext -> [filenames] */
	fileTypeBreakdown: Map<string, string[]>;
}

/**
 * BulkConvertEngine handles converting existing notes into tasks
 * by adding task identification metadata to their frontmatter.
 */
export class BulkConvertEngine {
	constructor(private plugin: TaskNotesPlugin) {}

	/**
	 * Pre-check items to determine how many can be converted vs already tasks.
	 */
	async preCheck(items: BasesDataItem[]): Promise<ConvertPreCheckResult> {
		const alreadyTaskPaths = new Set<string>();
		const nonMarkdownPaths = new Set<string>();
		const fileTypeBreakdown = new Map<string, string[]>();

		this.plugin.debugLog.log("BulkConvertEngine", "preCheck", {
			itemCount: items.length,
			itemPaths: items.map((item) => item.path || "(no path)"),
		});

		for (const item of items) {
			const sourcePath = item.path || "";
			if (!sourcePath) continue;

			const file = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
			if (!(file instanceof TFile)) continue;

			// Skip non-markdown files (e.g., .xlsx, .pdf, .png)
			if (file.extension !== "md") {
				nonMarkdownPaths.add(sourcePath);
				// Track by extension for breakdown
				const ext = file.extension.toLowerCase();
				if (!fileTypeBreakdown.has(ext)) {
					fileTypeBreakdown.set(ext, []);
				}
				fileTypeBreakdown.get(ext)!.push(file.basename);
				continue;
			}

			const metadata = this.plugin.app.metadataCache.getFileCache(file);
			const frontmatter = metadata?.frontmatter;
			if (frontmatter && this.plugin.cacheManager.isTaskFile(frontmatter)) {
				alreadyTaskPaths.add(sourcePath);
			}
		}

		const alreadyTasks = alreadyTaskPaths.size;
		const nonMarkdown = nonMarkdownPaths.size;
		const toConvert = items.length - alreadyTasks - nonMarkdown;

		this.plugin.debugLog.log("BulkConvertEngine", "preCheck result", {
			toConvert,
			alreadyTasks,
			nonMarkdown,
			alreadyTaskPaths: [...alreadyTaskPaths],
			nonMarkdownPaths: [...nonMarkdownPaths],
			fileTypeBreakdown: Object.fromEntries(fileTypeBreakdown),
		});

		return { toConvert, alreadyTasks, alreadyTaskPaths, nonMarkdown, nonMarkdownPaths, fileTypeBreakdown };
	}

	/**
	 * Convert notes into tasks by adding task metadata to their frontmatter.
	 */
	async convertNotes(
		items: BasesDataItem[],
		options: BulkConvertOptions
	): Promise<BulkConvertResult> {
		const result: BulkConvertResult = {
			converted: 0,
			skipped: 0,
			failed: 0,
			errors: [],
			convertedPaths: [],
		};

		if (items.length === 0) {
			return result;
		}

		// Pre-check which are already tasks
		options.onProgress?.(0, items.length, "Checking existing tasks...");
		const preCheck = await this.preCheck(items);

		const total = items.length;

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			const sourcePath = item.path || "";

			options.onProgress?.(i + 1, total, `Converting ${i + 1} of ${total}...`);

			// Skip non-markdown files (e.g., .xlsx, .pdf, .png)
			if (preCheck.nonMarkdownPaths.has(sourcePath)) {
				this.plugin.debugLog.log("BulkConvertEngine", `Skipping (non-markdown): ${sourcePath}`);
				result.skipped++;
				continue;
			}

			// Skip if already a task (unless reapply mode is on)
			if (preCheck.alreadyTaskPaths.has(sourcePath) && !options.reapplyToExistingTasks) {
				this.plugin.debugLog.log("BulkConvertEngine", `Skipping (already task): ${sourcePath}`);
				result.skipped++;
				continue;
			}

			// Skip if no valid file
			const file = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
			if (!(file instanceof TFile)) {
				result.failed++;
				result.errors.push(`File not found: ${sourcePath}`);
				continue;
			}

			try {
				await this.convertSingleNote(file, options);
				result.converted++;
				result.convertedPaths.push(sourcePath);
			} catch (error) {
				result.failed++;
				const errorMsg = error instanceof Error ? error.message : String(error);
				result.errors.push(`Error for ${sourcePath}: ${errorMsg}`);
			}
		}

		return result;
	}

	/**
	 * Convert a single note into a task by modifying its frontmatter.
	 * Existing frontmatter fields are NEVER overwritten — only missing fields are added.
	 */
	private async convertSingleNote(file: TFile, options: BulkConvertOptions): Promise<void> {
		const settings = this.plugin.settings;
		const fieldMapper = this.plugin.fieldMapper;

		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			// Step 1: Add task identification
			if (settings.taskIdentificationMethod === "property") {
				// Property method: set the configured property
				const propName = settings.taskPropertyName;
				const propValue = settings.taskPropertyValue;

				if (propName) {
					// SIMPLE FIX: Delete and re-set unconditionally
					// Previous conditional logic was too fragile and missed edge cases
					const oldValue = frontmatter[propName];
					delete frontmatter[propName];

					// Determine the value to write based on propValue setting
					const normalizedPropValue = (propValue || "").toLowerCase().trim();
					let newValue: boolean | string;

					if (normalizedPropValue === "" || normalizedPropValue === "true" || normalizedPropValue === "yes" || normalizedPropValue === "1") {
						newValue = true;
					} else if (normalizedPropValue === "false" || normalizedPropValue === "no" || normalizedPropValue === "0") {
						newValue = false;
					} else {
						// Custom string value (rare)
						newValue = propValue;
					}

					frontmatter[propName] = newValue;
					this.plugin.debugLog.log("BulkConvertEngine", `Set ${propName}: ${oldValue} → ${newValue} (${typeof newValue})`);
				}
			} else {
				// Tag method: ensure tags array includes the task tag
				const taskTag = settings.taskTag || "task";
				if (!Array.isArray(frontmatter.tags)) {
					frontmatter.tags = [];
				}
				if (!frontmatter.tags.includes(taskTag)) {
					frontmatter.tags.push(taskTag);
				}
			}

			// Step 2: Apply status and priority
			// Bulk values take precedence over defaults
			const statusField = fieldMapper.toUserField("status");
			if (options.status) {
				// Bulk status specified - apply it
				frontmatter[statusField] = options.status;
			} else if (options.applyDefaults && frontmatter[statusField] === undefined) {
				// No bulk status, apply default if missing
				frontmatter[statusField] = settings.defaultTaskStatus || "open";
			}

			const priorityField = fieldMapper.toUserField("priority");
			if (options.priority) {
				// Bulk priority specified - apply it
				frontmatter[priorityField] = options.priority;
			} else if (options.applyDefaults && frontmatter[priorityField] === undefined) {
				// No bulk priority, apply default if missing
				frontmatter[priorityField] = settings.defaultTaskPriority || "normal";
			}

			if (options.applyDefaults) {

				const dateCreatedField = fieldMapper.toUserField("dateCreated");
				if (frontmatter[dateCreatedField] === undefined) {
					frontmatter[dateCreatedField] = getCurrentTimestamp();
				}

				// Auto-set creator from device identity (if configured)
				if (this.plugin.userRegistry?.shouldAutoSetCreator()) {
					const creatorField = this.plugin.userRegistry.getCreatorFieldName();
					if (frontmatter[creatorField] === undefined) {
						const creatorValue = this.plugin.userRegistry.getCreatorValueForNewTask();
						if (creatorValue) {
							frontmatter[creatorField] = creatorValue;
						}
					}
				}

				// Auto-generate note UUID (if enabled and missing)
				if (this.plugin.noteUuidService?.shouldAutoGenerate()) {
					const uuidPropName = this.plugin.noteUuidService.getPropertyName();
					if (frontmatter[uuidPropName] === undefined) {
						frontmatter[uuidPropName] = this.plugin.noteUuidService.generateUuid();
					}
				}
			}

			// Step 2.5: Link to base view if requested
			if (options.linkToBase && options.baseFilePath) {
				const projectsField = fieldMapper.toUserField("projects");
				const baseFileRef = this.plugin.app.vault.getAbstractFileByPath(options.baseFilePath);
				if (baseFileRef instanceof TFile) {
					const link = this.plugin.app.fileManager.generateMarkdownLink(baseFileRef, file.path);
					if (frontmatter[projectsField] === undefined) {
						frontmatter[projectsField] = [link];
					} else if (Array.isArray(frontmatter[projectsField])) {
						if (!frontmatter[projectsField].includes(link)) {
							frontmatter[projectsField].push(link);
						}
					}
				}
			}

			// Step 2.6: Apply due date if specified (only if missing)
			if (options.dueDate) {
				const dueField = fieldMapper.toUserField("due");
				if (frontmatter[dueField] === undefined) {
					frontmatter[dueField] = options.dueDate;
				}
			}

			// Step 2.7: Apply scheduled date if specified (only if missing)
			if (options.scheduledDate) {
				const scheduledField = fieldMapper.toUserField("scheduled");
				if (frontmatter[scheduledField] === undefined) {
					frontmatter[scheduledField] = options.scheduledDate;
				}
			}

			// Step 2.8: Apply bulk reminders if provided
			if (options.reminders && options.reminders.length > 0) {
				const remindersField = fieldMapper.toUserField("reminders");
				if (frontmatter[remindersField] === undefined) {
					// Apply all bulk reminders with unique IDs
					frontmatter[remindersField] = options.reminders.map(r => ({
						id: r.id || `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
						type: r.type,
						relatedTo: r.relatedTo,
						offset: r.offset,
						absoluteTime: r.absoluteTime,
						description: r.description,
					}));
				}
			}

			// Apply custom frontmatter properties
			if (options.customFrontmatter) {
				for (const [key, value] of Object.entries(options.customFrontmatter)) {
					if (value !== null && value !== undefined && value !== "") {
						frontmatter[key] = value;
					}
				}
			}

			// Step 2.9: Apply per-view field mapping (ADR-011)
			// Renames global property names to view-specific names and writes tracking props
			if (options.viewFieldMapping) {
				this.plugin.debugLog?.log("BulkConvert", `Applying viewFieldMapping to ${file.path}`, options.viewFieldMapping);
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

					// Rename property: move value from global name to custom name
					const hasGlobalValue = frontmatter[globalPropName] !== undefined;
					if (hasGlobalValue) {
						frontmatter[customPropName] = frontmatter[globalPropName];
						delete frontmatter[globalPropName];
					}
					// Always write tracking property when mapping exists — makes
					// the task self-describing even if the custom property has no
					// value yet (belt-and-suspenders for retroactive mapping)
					frontmatter[trackingProp] = customPropName;
				}

				// Handle assignee separately (uses settings, not FieldMapping)
				if (mapping.assignee?.trim()) {
					const globalAssigneeProp = settings.assigneeFieldName || "assignee";
					if (mapping.assignee !== globalAssigneeProp) {
						const hasAssigneeValue = frontmatter[globalAssigneeProp] !== undefined;
						if (hasAssigneeValue) {
							frontmatter[mapping.assignee] = frontmatter[globalAssigneeProp];
							delete frontmatter[globalAssigneeProp];
						}
						frontmatter[FIELD_OVERRIDE_PROPS.assignee] = mapping.assignee;
					}
				}
			}

			// Step 2.10: Write provenance tracking (ADR-011)
			if (this.plugin.settings.baseIdentityTrackSourceView) {
				if (options.sourceBaseId) {
					frontmatter["tnSourceBaseId"] = options.sourceBaseId;
				}
				if (options.sourceViewId) {
					frontmatter["tnSourceViewId"] = options.sourceViewId;
				}
			}

			// Step 3: Always update dateModified
			const dateModifiedField = fieldMapper.toUserField("dateModified");
			frontmatter[dateModifiedField] = getCurrentTimestamp();
		});

		// Wait for metadata cache to index the changes
		if (this.plugin.cacheManager.waitForFreshTaskData) {
			await this.plugin.cacheManager.waitForFreshTaskData(file);
		}
	}
}
