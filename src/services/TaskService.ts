import {
	EVENT_TASK_DELETED,
	EVENT_TASK_UPDATED,
	TaskCreationData,
	TaskDependency,
	TaskInfo,
	TimeEntry,
	IWebhookNotifier,
} from "../types";
import { AutoArchiveService } from "./AutoArchiveService";
import {
	FilenameContext,
	generateTaskFilename,
	generateUniqueFilename,
} from "../utils/filenameGenerator";
import { Notice, TFile, normalizePath, stringifyYaml } from "obsidian";
import {
	TemplateData,
	mergeTemplateFrontmatter,
	processTemplate,
} from "../utils/templateProcessor";
import {
	addDTSTARTToRecurrenceRule,
	calculateDefaultDate,
	updateDTSTARTInRecurrenceRule,
	ensureFolderExists,
	updateToNextScheduledOccurrence,
	splitFrontmatterAndBody,
	resetMarkdownCheckboxes,
} from "../utils/helpers";
import {
	DEFAULT_DEPENDENCY_RELTYPE,
	formatDependencyLink,
	normalizeDependencyEntry,
	resolveDependencyEntry,
} from "../utils/dependencyUtils";
import { getProjectDisplayName } from "../utils/linkUtils";
import {
	formatDateForStorage,
	getCurrentDateString,
	getCurrentTimestamp,
	getTodayLocal,
	createUTCDateFromLocalCalendarDate,
} from "../utils/dateUtils";
import { format } from "date-fns";
import { processFolderTemplate, TaskTemplateData } from "../utils/folderTemplateProcessor";

import TaskNotesPlugin from "../main";
import { TranslationKey } from "../i18n";

export class TaskService {
	private webhookNotifier?: IWebhookNotifier;
	private autoArchiveService?: AutoArchiveService;

	constructor(private plugin: TaskNotesPlugin) { }

	private translate(key: TranslationKey, variables?: Record<string, any>): string {
		return this.plugin.i18n.translate(key, variables);
	}

	/**
	 * Sanitize title by removing problematic characters that could cause issues in filenames
	 * This is used when storeTitleInFilename is true, to ensure the title is safe for filenames
	 */
	private sanitizeTitleForFilename(input: string): string {
		if (!input || typeof input !== "string") {
			return "untitled";
		}

		try {
			let processed = input;

			// Process Wikilinks: [[Link|Alias]] -> Alias, or [[Link]] -> Link
			processed = processed.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, link, alias) => {
				return (alias || link || "").trim();
			});

			// Process Markdown links: [Text](URL) -> Text
			processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text) => {
				return (text || "").trim();
			});

			// Remove protocol prefixes
			processed = processed.replace(/https?:\/\//g, "");

			// Remove or replace problematic characters
			let sanitized = processed
				.trim()
				// Replace multiple spaces with single space
				.replace(/\s+/g, " ")
				// Remove characters that are problematic in filenames and content
				.replace(/[<>:"/\\|?*#[\]]/g, "")
				// Remove control characters separately
				.replace(/./g, (char) => {
					const code = char.charCodeAt(0);
					return code <= 31 || (code >= 127 && code <= 159) ? "" : char;
				})
				// Remove leading/trailing dots
				.replace(/^\.+|\.+$/g, "")
				// Final trim in case we removed characters at the edges
				.trim();

			// Additional validation
			if (!sanitized || sanitized.length === 0) {
				sanitized = "untitled";
			}

			return sanitized;
		} catch (error) {
			console.error("Error sanitizing title:", error);
			return "untitled";
		}
	}

	private retrieveTitleLinks(input: string): string[] {
		if (!input) return [];
		// Regex to match both Obsidian links [[link|alias]] and Markdown links [alias](target)
		const anyLinkRegex = /\[\[.*?\]\]|\[.*?\]\(.*?\)/g;
		const matches = input.match(anyLinkRegex);
		return matches || [];
	}

	/**
	 * Minimal sanitization for titles stored in frontmatter (not used in filename)
	 * Only removes control characters and normalizes whitespace, preserving special characters like ?
	 */
	private sanitizeTitleForStorage(input: string): string {
		if (!input || typeof input !== "string") {
			return "untitled";
		}

		try {
			let sanitized = input
				.trim()
				// Replace multiple spaces with single space
				.replace(/\s+/g, " ")
				// Remove control characters only
				.replace(/./g, (char) => {
					const code = char.charCodeAt(0);
					return code <= 31 || (code >= 127 && code <= 159) ? "" : char;
				})
				// Final trim in case we removed characters at the edges
				.trim();

			// Additional validation
			if (!sanitized || sanitized.length === 0) {
				sanitized = "untitled";
			}

			return sanitized;
		} catch (error) {
			console.error("Error sanitizing title:", error);
			return "untitled";
		}
	}

	/**
	 * Set webhook notifier for triggering webhook events
	 * Called after HTTPAPIService is initialized to avoid circular dependencies
	 */
	setWebhookNotifier(notifier: IWebhookNotifier): void {
		this.webhookNotifier = notifier;
	}

	/**
	 * Set auto-archive service for handling automatic archiving
	 */
	setAutoArchiveService(service: AutoArchiveService): void {
		this.autoArchiveService = service;
	}

	/**
	 * Process a folder path template with task and date variables
	 *
	 * This method enables dynamic folder creation by replacing template variables
	 * with actual values from the task data and current date.
	 *
	 * Supported task variables:
	 * - {{context}} - First context from the task's contexts array
	 * - {{project}} - First project from the task's projects array
	 * - {{contexts}} - All contexts joined by `/`
	 * - {{projects}} - All projects joined by `/`
	 * - {{priority}} - Task priority (e.g., "high", "medium", "low")
	 * - {{status}} - Task status (e.g., "todo", "in-progress", "done")
	 * - {{title}} - Task title (sanitized for folder names)
	 *
	 * Supported date variables:
	 * - {{year}} - Current year (e.g., "2025")
	 * - {{month}} - Current month with leading zero (e.g., "08")
	 * - {{day}} - Current day with leading zero (e.g., "15")
	 * - {{date}} - Full current date (e.g., "2025-08-15")
	 *
	 * @param folderTemplate - The template string with variables to process
	 * @param taskData - Optional task data for variable substitution
	 * @param date - Date to use for date variables (defaults to current date)
	 * @returns Processed folder path with variables replaced
	 *
	 * @example
	 * processFolderTemplate("Tasks/{{year}}/{{month}}", taskData)
	 * // Returns: "Tasks/2025/08"
	 *
	 * @example
	 * processFolderTemplate("{{project}}/{{priority}}", taskData)
	 * // Returns: "ProjectName/high"
	 */
	private processFolderTemplate(
		folderTemplate: string,
		taskData?: TaskCreationData,
		date: Date = new Date()
	): string {
		// Convert TaskCreationData to TaskTemplateData
		const templateData: TaskTemplateData | undefined = taskData
			? {
				title: taskData.title,
				priority: taskData.priority,
				status: taskData.status,
				contexts: taskData.contexts,
				projects: taskData.projects,
				due: taskData.due,
				scheduled: taskData.scheduled,
			}
			: undefined;

		// Use the shared folder template processor utility
		return processFolderTemplate(folderTemplate, {
			date,
			taskData: templateData,
			extractProjectBasename: (project) => this.extractProjectBasename(project),
		});
	}

	/**
	 * Create a new task file with all the necessary setup
	 * This is the central method for task creation used by all components
	 *
	 * @param taskData - The task data to create
	 * @param options - Optional settings for task creation
	 * @param options.applyDefaults - Whether to apply task creation defaults. Set to false for imports (e.g., ICS events) that shouldn't have defaults applied. Defaults to true.
	 */
	async createTask(
		taskData: TaskCreationData,
		options: { applyDefaults?: boolean } = {}
	): Promise<{ file: TFile; taskInfo: TaskInfo }> {
		const { applyDefaults = true } = options;
		try {
			// Apply task creation defaults if enabled
			if (applyDefaults) {
				taskData = await this.applyTaskCreationDefaults(taskData);
			}

			// Validate required fields
			if (!taskData.title || !taskData.title.trim()) {
				throw new Error("Title is required");
			}

			// Apply defaults for missing fields and sanitize title
			// Use stricter sanitization only when title is used in filename
			const title = this.plugin.settings.storeTitleInFilename
				? this.sanitizeTitleForFilename(taskData.title.trim())
				: this.sanitizeTitleForStorage(taskData.title.trim());
			const priority = taskData.priority || this.plugin.settings.defaultTaskPriority;
			const status = taskData.status || this.plugin.settings.defaultTaskStatus;
			const dateCreated = taskData.dateCreated || getCurrentTimestamp();
			const dateModified = taskData.dateModified || getCurrentTimestamp();
			const titleLinks = this.retrieveTitleLinks(taskData.title);

			// Prepare contexts, projects, and tags arrays
			const contextsArray = taskData.contexts || [];
			const projectsArray = taskData.projects || [];
			// Handle tags based on identification method
			let tagsArray = taskData.tags || [];

			// Only add task tag if using tag-based identification
			if (this.plugin.settings.taskIdentificationMethod === "tag") {
				if (!tagsArray.includes(this.plugin.settings.taskTag)) {
					tagsArray = [this.plugin.settings.taskTag, ...tagsArray];
				}
			}

			// Generate filename
			const filenameContext: FilenameContext = {
				title: title,
				priority: priority,
				status: status,
				date: new Date(),
				dueDate: taskData.due,
				scheduledDate: taskData.scheduled,
			};

			const baseFilename = generateTaskFilename(filenameContext, this.plugin.settings);

			// Determine folder based on creation context
			// Process folder templates with task and date variables for dynamic folder organization
			let folder = "";
			if (taskData.creationContext === "inline-conversion" || taskData.creationContext === "modal-inline-creation") {
				// For inline conversion and modal-based inline task creation, use the inline task folder setting with variable support
				const inlineFolder = this.plugin.settings.inlineTaskConvertFolder || "";
				if (inlineFolder.trim()) {
					// Inline folder is configured, use it
					folder = inlineFolder;

					// Handle currentNotePath and currentNoteTitle template variables
					if (
						inlineFolder.includes("{{currentNotePath}}") ||
						inlineFolder.includes("{{currentNoteTitle}}")
					) {
						const currentFile = this.plugin.app.workspace.getActiveFile();

						if (inlineFolder.includes("{{currentNotePath}}")) {
							// Get current file's folder path
							const currentFolderPath = currentFile?.parent?.path || "";
							folder = folder.replace(/\{\{currentNotePath\}\}/g, currentFolderPath);
						}

						if (inlineFolder.includes("{{currentNoteTitle}}")) {
							// Get current file's title (basename without extension)
							const currentNoteTitle = currentFile?.basename || "";
							folder = folder.replace(/\{\{currentNoteTitle\}\}/g, currentNoteTitle);
						}
					}
					// Process task and date variables in the inline folder path
					folder = this.processFolderTemplate(folder, taskData);
				} else {
					// Fallback to default tasks folder when inline folder is empty (#128)
					const tasksFolder = this.plugin.settings.tasksFolder || "";
					folder = this.processFolderTemplate(tasksFolder, taskData);
				}
			} else {
				// For manual creation and other contexts, use the general tasks folder
				const tasksFolder = this.plugin.settings.tasksFolder || "";
				folder = this.processFolderTemplate(tasksFolder, taskData);
			}

			// Ensure folder exists
			if (folder) {
				await ensureFolderExists(this.plugin.app.vault, folder);
			}

			// Generate unique filename
			const uniqueFilename = await generateUniqueFilename(
				baseFilename,
				folder,
				this.plugin.app.vault
			);
			const fullPath = folder ? `${folder}/${uniqueFilename}.md` : `${uniqueFilename}.md`;

			// Create complete TaskInfo object with all the data
			const completeTaskData: Partial<TaskInfo> = {
				title: title,
				status: status,
				priority: priority,
				due: taskData.due || undefined,
				scheduled: taskData.scheduled || undefined,
				contexts: contextsArray.length > 0 ? contextsArray : undefined,
				projects: projectsArray.length > 0 ? projectsArray : undefined,
				timeEstimate:
					taskData.timeEstimate && taskData.timeEstimate > 0
						? taskData.timeEstimate
						: undefined,
				dateCreated: dateCreated,
				dateModified: dateModified,
				recurrence: taskData.recurrence || undefined,
				recurrence_anchor: taskData.recurrence_anchor || undefined,
				reminders:
					taskData.reminders && taskData.reminders.length > 0
						? taskData.reminders
						: undefined,
				icsEventId: taskData.icsEventId || undefined,
			};

			// Add DTSTART to recurrence rule if it doesn't have one
			// This ensures Google Calendar sync works correctly from the start
			if (
				completeTaskData.recurrence &&
				typeof completeTaskData.recurrence === "string" &&
				!completeTaskData.recurrence.includes("DTSTART:")
			) {
				const tempTaskInfo: TaskInfo = {
					...completeTaskData,
					title: title,
					status: status,
					priority: priority,
					path: "", // Path not yet known, but not needed for DTSTART calculation
					archived: false,
				};
				const recurrenceWithDTSTART = addDTSTARTToRecurrenceRule(tempTaskInfo);
				if (recurrenceWithDTSTART) {
					completeTaskData.recurrence = recurrenceWithDTSTART;
				}
			}

			const shouldAddTaskTag = this.plugin.settings.taskIdentificationMethod === "tag";
			const taskTagForFrontmatter = shouldAddTaskTag
				? this.plugin.settings.taskTag
				: undefined;

			// Use field mapper to convert to frontmatter with proper field mapping
			const frontmatter = this.plugin.fieldMapper.mapToFrontmatter(
				completeTaskData,
				taskTagForFrontmatter,
				this.plugin.settings.storeTitleInFilename
			);

			// Handle task identification based on settings
			if (this.plugin.settings.taskIdentificationMethod === "property") {
				const propName = this.plugin.settings.taskPropertyName;
				const propValue = this.plugin.settings.taskPropertyValue;
				if (propName && propValue) {
					// Coerce boolean-like strings to actual booleans for compatibility with Obsidian properties
					const lower = propValue.toLowerCase();
					const coercedValue =
						lower === "true" || lower === "false" ? lower === "true" : propValue;
					frontmatter[propName] = coercedValue as any;
				}
				if (tagsArray.length > 0) {
					frontmatter.tags = tagsArray;
				}
			} else {
				// Tags are handled separately (not via field mapper)
				frontmatter.tags = tagsArray;
			}

			// Apply template processing (both frontmatter and body)
			const templateResult = await this.applyTemplate(taskData);
			const normalizedBody = templateResult.body
				? templateResult.body.replace(/\r\n/g, "\n").trimEnd()
				: taskData.details
					? taskData.details.replace(/\r\n/g, "\n").trimEnd()
					: "";

			// Merge template frontmatter with base frontmatter
			// User-defined values take precedence over template frontmatter
			let finalFrontmatter = mergeTemplateFrontmatter(
				frontmatter,
				templateResult.frontmatter
			);

			// Add custom frontmatter properties (including user fields)
			if (taskData.customFrontmatter) {
				finalFrontmatter = { ...finalFrontmatter, ...taskData.customFrontmatter };
			}

			// Prepare the body content, prepending title links if any
			let finalBody = normalizedBody;
			if (titleLinks && titleLinks.length > 0) {
				const linksHeader = titleLinks.join("\n");
				finalBody = linksHeader + (normalizedBody ? "\n\n" + normalizedBody : "");
			}

			// Prepare file content
			const yamlHeader = stringifyYaml(finalFrontmatter);
			let content = `---\n${yamlHeader}---\n\n`;

			if (finalBody.length > 0) {
				content += `${finalBody}\n`;
			}

			// Create the file
			const file = await this.plugin.app.vault.create(fullPath, content);

			// Create final TaskInfo object for cache and events
			// Ensure required fields are present by using the complete task data as base
			const taskInfo: TaskInfo = {
				...completeTaskData,
				...finalFrontmatter,
				// Ensure required fields are always defined
				title: finalFrontmatter.title || completeTaskData.title || title,
				status: finalFrontmatter.status || completeTaskData.status || status,
				priority: finalFrontmatter.priority || completeTaskData.priority || priority,
				path: file.path,
				tags: tagsArray,
				archived: false,
				details: finalBody,
			};

			// Wait for fresh data and update cache
			try {
				// Wait for the metadata cache to have the updated data for new tasks
				if (this.plugin.cacheManager.waitForFreshTaskData) {
					await this.plugin.cacheManager.waitForFreshTaskData(file);
				}
				this.plugin.cacheManager.updateTaskInfoInCache(file.path, taskInfo);
			} catch (cacheError) {
				console.error("Error updating cache for new task:", cacheError);
			}

			// Emit task created event
			this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
				path: file.path,
				updatedTask: taskInfo,
			});

			// Trigger webhook for task creation
			if (this.webhookNotifier) {
				try {
					await this.webhookNotifier.triggerWebhook("task.created", { task: taskInfo });
				} catch (error) {
					console.warn("Failed to trigger webhook for task creation:", error);
				}
			}

			// Sync to Google Calendar if enabled (fire-and-forget to avoid blocking modal)
			if (
				this.plugin.taskCalendarSyncService?.isEnabled() &&
				this.plugin.settings.googleCalendarExport.syncOnTaskCreate
			) {
				this.plugin.taskCalendarSyncService.syncTaskToCalendar(taskInfo).catch((error) => {
					console.warn("Failed to sync task to Google Calendar:", error);
				});
			}

			return { file, taskInfo };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			// eslint-disable-next-line no-console
			console.error("Error creating task:", {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				taskData,
			});

			throw new Error(`Failed to create task: ${errorMessage}`);
		}
	}

	/**
	 * Apply template to task (both frontmatter and body) if enabled in settings
	 */
	private async applyTemplate(
		taskData: TaskCreationData
	): Promise<{ frontmatter: Record<string, any>; body: string }> {
		const defaults = this.plugin.settings.taskCreationDefaults;

		// Check if body template is enabled and configured
		if (!defaults.useBodyTemplate || !defaults.bodyTemplate?.trim()) {
			// No template configured, return empty frontmatter and details as body
			return {
				frontmatter: {},
				body: taskData.details?.trim() || "",
			};
		}

		try {
			// Normalize the template path and ensure it has .md extension
			let templatePath = normalizePath(defaults.bodyTemplate.trim());
			if (!templatePath.endsWith(".md")) {
				templatePath += ".md";
			}

			// Try to load the template file
			const templateFile = this.plugin.app.vault.getAbstractFileByPath(templatePath);
			if (templateFile instanceof TFile) {
				const templateContent = await this.plugin.app.vault.read(templateFile);

				// Prepare task data for template variables (with all final values)
				const templateTaskData: TemplateData = {
					title: taskData.title || "",
					priority: taskData.priority || "",
					status: taskData.status || "",
					contexts: Array.isArray(taskData.contexts) ? taskData.contexts : [],
					tags: Array.isArray(taskData.tags) ? taskData.tags : [],
					timeEstimate: taskData.timeEstimate || 0,
					dueDate: taskData.due || "",
					scheduledDate: taskData.scheduled || "",
					details: taskData.details || "",
					parentNote: taskData.parentNote || "",
				};

				// Process the complete template (frontmatter + body)
				return processTemplate(templateContent, templateTaskData);
			} else {
				// Template file not found, log error and return details as-is
				// eslint-disable-next-line no-console
				console.warn(`Task body template not found: ${templatePath}`);
				new Notice(
					this.translate("services.task.notices.templateNotFound", { path: templatePath })
				);
				return {
					frontmatter: {},
					body: taskData.details?.trim() || "",
				};
			}
		} catch (error) {
			// Error reading template, log error and return details as-is
			console.error("Error reading task body template:", error);
			new Notice(
				this.translate("services.task.notices.templateReadError", {
					template: defaults.bodyTemplate,
				})
			);
			return {
				frontmatter: {},
				body: taskData.details?.trim() || "",
			};
		}
	}

	/**
	 * Apply task creation defaults from settings to task data
	 * This includes due date, scheduled date, contexts, projects, tags,
	 * time estimate, recurrence, reminders, and user field defaults.
	 */
	private async applyTaskCreationDefaults(taskData: TaskCreationData): Promise<TaskCreationData> {
		const defaults = this.plugin.settings.taskCreationDefaults;
		const result = { ...taskData };

		// Apply default due date if not provided
		if (!result.due && defaults.defaultDueDate !== "none") {
			result.due = calculateDefaultDate(defaults.defaultDueDate);
		}

		// Apply default scheduled date if not provided
		if (!result.scheduled && defaults.defaultScheduledDate !== "none") {
			result.scheduled = calculateDefaultDate(defaults.defaultScheduledDate);
		}

		// Apply default contexts if not provided
		if (!result.contexts && defaults.defaultContexts) {
			result.contexts = defaults.defaultContexts
				.split(",")
				.map((c) => c.trim())
				.filter((c) => c);
		}

		// Apply default projects if not provided
		if (!result.projects && defaults.defaultProjects) {
			result.projects = defaults.defaultProjects
				.split(",")
				.map((p) => p.trim())
				.filter((p) => p);
		}

		// Apply default tags if not provided
		if (!result.tags && defaults.defaultTags) {
			result.tags = defaults.defaultTags
				.split(",")
				.map((t) => t.trim())
				.filter((t) => t);
		}

		// Apply default time estimate if not provided
		if (!result.timeEstimate && defaults.defaultTimeEstimate > 0) {
			result.timeEstimate = defaults.defaultTimeEstimate;
		}

		// Apply default recurrence if not provided
		if (!result.recurrence && defaults.defaultRecurrence && defaults.defaultRecurrence !== "none") {
			const freqMap: Record<string, string> = {
				daily: "FREQ=DAILY",
				weekly: "FREQ=WEEKLY",
				monthly: "FREQ=MONTHLY",
				yearly: "FREQ=YEARLY",
			};
			result.recurrence = freqMap[defaults.defaultRecurrence] || undefined;
		}

		// Apply default reminders if not provided
		if (!result.reminders && defaults.defaultReminders && defaults.defaultReminders.length > 0) {
			const { convertDefaultRemindersToReminders } = await import("../utils/settingsUtils");
			result.reminders = convertDefaultRemindersToReminders(defaults.defaultReminders);
		}

		// Apply default values for user-defined fields
		const userFields = this.plugin.settings.userFields;
		if (userFields && userFields.length > 0) {
			if (!result.customFrontmatter) {
				result.customFrontmatter = {};
			}
			for (const field of userFields) {
				// Only apply default if the field isn't already set
				if (field.defaultValue !== undefined && result.customFrontmatter[field.key] === undefined) {
					// For date fields, convert preset values (today, tomorrow, next-week) to actual dates
					if (field.type === "date" && typeof field.defaultValue === "string") {
						const calculatedDate = calculateDefaultDate(
							field.defaultValue as "none" | "today" | "tomorrow" | "next-week"
						);
						if (calculatedDate) {
							result.customFrontmatter[field.key] = calculatedDate;
						}
					} else {
						result.customFrontmatter[field.key] = field.defaultValue;
					}
				}
			}
		}

		return result;
	}

	/**
	 * Toggle the status of a task between completed and open
	 */
	async toggleStatus(task: TaskInfo): Promise<TaskInfo> {
		try {
			// Determine new status
			const isCurrentlyCompleted = this.plugin.statusManager.isCompletedStatus(task.status);
			const newStatus = isCurrentlyCompleted
				? this.plugin.settings.defaultTaskStatus // Revert to default open status
				: this.plugin.statusManager.getCompletedStatuses()[0] || "done"; // Set to first completed status

			return await this.updateProperty(task, "status", newStatus);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("Error toggling task status:", {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				taskPath: task.path,
				currentStatus: task.status,
			});

			throw new Error(`Failed to toggle task status: ${errorMessage}`);
		}
	}

	/**
	 * Update a single property of a task following the deterministic data flow pattern
	 */
	async updateProperty(
		task: TaskInfo,
		property: keyof TaskInfo,
		value: any,
		options: { silent?: boolean } = {}
	): Promise<TaskInfo> {
		try {
			const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
			if (!(file instanceof TFile)) {
				throw new Error(`Cannot find task file: ${task.path}`);
			}

			// Get fresh task data to prevent overwrites
			const freshTask = (await this.plugin.cacheManager.getTaskInfo(task.path)) || task;

			// Step 1: Construct new state in memory using fresh data
			const updatedTask = { ...freshTask } as Record<string, any>;
			updatedTask[property] = value;
			updatedTask.dateModified = getCurrentTimestamp();

			// Handle derivative changes for status updates
			if (property === "status" && !freshTask.recurrence) {
				if (this.plugin.statusManager.isCompletedStatus(value)) {
					updatedTask.completedDate = getCurrentDateString();
				} else {
					updatedTask.completedDate = undefined;
				}
			}

			// Step 2: Persist to file
			await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
				// Use field mapper to get the correct frontmatter property name
				const fieldName = this.plugin.fieldMapper.toUserField(
					property as keyof import("../types").FieldMapping
				);

				if (property === "status") {
					// Coerce boolean-like status strings to actual booleans for compatibility with Obsidian checkbox properties
					const lower = String(value).toLowerCase();
					const coercedValue =
						lower === "true" || lower === "false" ? lower === "true" : value;
					frontmatter[fieldName] = coercedValue;

					// Update completed date when marking as complete (non-recurring tasks only)
					// FIX: Use freshTask instead of stale task to check recurrence
					this.updateCompletedDateInFrontmatter(frontmatter, value, !!freshTask.recurrence);
				} else if ((property === "due" || property === "scheduled") && !value) {
					// Remove empty due/scheduled dates
					delete frontmatter[fieldName];
				} else {
					frontmatter[fieldName] = value;
				}

				// Always update the modification timestamp using field mapper
				const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");
				frontmatter[dateModifiedField] = updatedTask.dateModified;
			});

			// Step 3: Wait for fresh data and update cache
			try {
				// Wait for the metadata cache to have the updated data
				if (this.plugin.cacheManager.waitForFreshTaskData) {
					await this.plugin.cacheManager.waitForFreshTaskData(file);
				}
				this.plugin.cacheManager.updateTaskInfoInCache(
					task.path,
					updatedTask as TaskInfo
				);
			} catch (cacheError) {
				// Cache errors shouldn't break the operation, just log them
				// eslint-disable-next-line no-console
				console.error("Error updating task cache:", {
					error: cacheError instanceof Error ? cacheError.message : String(cacheError),
					taskPath: task.path,
				});
			}

			// Step 4: Notify system of change
			try {
				this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
					path: task.path,
					originalTask: task,
					updatedTask: updatedTask as TaskInfo,
				});

				// Step 5: If status changed, trigger UI updates for dependent tasks
				if (property === "status") {
					const wasCompleted = this.plugin.statusManager.isCompletedStatus(task.status);
					const isNowCompleted = this.plugin.statusManager.isCompletedStatus(value);

					if (wasCompleted !== isNowCompleted) {
						// Get tasks that this task blocks (they need UI updates for their blocked state)
						const dependentTaskPaths = this.plugin.cacheManager.getBlockedTaskPaths(
							task.path
						);

						// Trigger updates for each dependent task so their UI can refresh
						for (const dependentPath of dependentTaskPaths) {
							try {
								const dependentTask =
									await this.plugin.cacheManager.getTaskInfo(dependentPath);
								if (dependentTask) {
									this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
										path: dependentPath,
										originalTask: dependentTask,
										updatedTask: dependentTask, // The dependent task itself didn't change, just needs UI refresh
									});
								}
							} catch (dependentError) {
								console.error(
									`Error triggering update for dependent task ${dependentPath}:`,
									dependentError
								);
							}
						}
					}
				}
			} catch (eventError) {
				// eslint-disable-next-line no-console
				console.error("Error emitting task update event:", {
					error: eventError instanceof Error ? eventError.message : String(eventError),
					taskPath: task.path,
				});
				// Event emission errors shouldn't break the operation
			}

			// Trigger webhooks for property updates
			if (this.webhookNotifier) {
				try {
					// Check if this was a completion
					const wasCompleted = this.plugin.statusManager.isCompletedStatus(task.status);
					const isCompleted =
						property === "status" && this.plugin.statusManager.isCompletedStatus(value);

					if (property === "status" && !wasCompleted && isCompleted) {
						// Task was completed
						await this.webhookNotifier.triggerWebhook("task.completed", {
							task: updatedTask as TaskInfo,
						});
					} else {
						// Regular property update
						await this.webhookNotifier.triggerWebhook("task.updated", {
							task: updatedTask as TaskInfo,
							previous: task,
						});
					}
				} catch (error) {
					console.warn("Failed to trigger webhook for property update:", error);
				}
			}

			// Sync to Google Calendar if enabled (fire-and-forget to avoid blocking modal)
			if (this.plugin.taskCalendarSyncService?.isEnabled()) {
				const wasCompleted = this.plugin.statusManager.isCompletedStatus(task.status);
				const isCompleted =
					property === "status" && this.plugin.statusManager.isCompletedStatus(value);

				const syncPromise =
					property === "status" && !wasCompleted && isCompleted
						? this.plugin.taskCalendarSyncService.completeTaskInCalendar(
							updatedTask as TaskInfo
						)
						: this.plugin.taskCalendarSyncService.updateTaskInCalendar(
							updatedTask as TaskInfo,
							task
						);

				syncPromise.catch((error) => {
					console.warn("Failed to sync task update to Google Calendar:", error);
				});
			}

			// Handle auto-archive if status property changed
			if (this.autoArchiveService && property === "status" && value !== task.status) {
				try {
					const statusConfig = this.plugin.statusManager.getStatusConfig(value as string);
					if (statusConfig) {
						if (statusConfig.autoArchive) {
							// Schedule for auto-archive
							await this.autoArchiveService.scheduleAutoArchive(
								updatedTask as TaskInfo,
								statusConfig
							);
						} else {
							// Cancel any pending auto-archive since new status doesn't have auto-archive
							await this.autoArchiveService.cancelAutoArchive(
								(updatedTask as TaskInfo).path
							);
						}
					}
				} catch (error) {
					console.warn(
						"Failed to handle auto-archive for status property change:",
						error
					);
				}
			}

			// Step 5: Return authoritative data
			return updatedTask as TaskInfo;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			// eslint-disable-next-line no-console
			console.error("Error updating task property:", {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				taskPath: task.path,
				property: String(property),
				value,
			});

			throw new Error(`Failed to update task property: ${errorMessage}`);
		}
	}

	/**
	 * Toggle the archive status of a task
	 */
	async toggleArchive(task: TaskInfo): Promise<TaskInfo> {
		const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
		if (!(file instanceof TFile)) {
			throw new Error(`Cannot find task file: ${task.path}`);
		}

		const archiveTag = this.plugin.fieldMapper.getMapping().archiveTag;
		const isCurrentlyArchived = task.archived;

		// Step 1: Construct new state in memory
		const updatedTask = { ...task };
		updatedTask.archived = !isCurrentlyArchived;
		updatedTask.dateModified = getCurrentTimestamp();

		// Update tags array to include/exclude archive tag
		if (!updatedTask.tags) {
			updatedTask.tags = [];
		}

		if (isCurrentlyArchived) {
			// Remove archive tag
			updatedTask.tags = updatedTask.tags.filter((tag) => tag !== archiveTag);
		} else {
			// Add archive tag if not present
			if (!updatedTask.tags.includes(archiveTag)) {
				updatedTask.tags = [...updatedTask.tags, archiveTag];
			}
		}

		// Step 2: Persist to file
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");

			// Toggle archived property (note: archived is handled via tags, not as a separate field)
			if (isCurrentlyArchived) {
				// Remove archive tag from tags array if present
				if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
					frontmatter.tags = frontmatter.tags.filter((tag: string) => tag !== archiveTag);
					if (frontmatter.tags.length === 0) {
						delete frontmatter.tags;
					}
				}
			} else {
				// Add archive tag to tags array
				if (!frontmatter.tags) {
					frontmatter.tags = [];
				} else if (!Array.isArray(frontmatter.tags)) {
					frontmatter.tags = [frontmatter.tags];
				}

				if (!frontmatter.tags.includes(archiveTag)) {
					frontmatter.tags.push(archiveTag);
				}
			}

			// Always update the modification timestamp using field mapper
			frontmatter[dateModifiedField] = updatedTask.dateModified;
		});

		// Step 2.5: Move file based on archive operation and settings
		let movedFile = file;
		if (this.plugin.settings.moveArchivedTasks) {
			try {
				if (!isCurrentlyArchived && this.plugin.settings.archiveFolder?.trim()) {
					// Archiving: Move to archive folder
					const archiveFolderTemplate = this.plugin.settings.archiveFolder.trim();
					// Process template variables in archive folder path
					const archiveFolder = this.processFolderTemplate(archiveFolderTemplate, {
						title: updatedTask.title || "",
						priority: updatedTask.priority,
						status: updatedTask.status,
						contexts: updatedTask.contexts,
						projects: updatedTask.projects,
					});

					// Ensure archive folder exists
					await ensureFolderExists(this.plugin.app.vault, archiveFolder);

					// Construct new path in archive folder
					const newPath = `${archiveFolder}/${file.name}`;

					// Check if file already exists at destination
					const existingFile = this.plugin.app.vault.getAbstractFileByPath(newPath);
					if (existingFile) {
						throw new Error(
							`A file named "${file.name}" already exists in the archive folder "${archiveFolder}". Cannot move task to avoid overwriting existing file.`
						);
					}

					// Move the file
					await this.plugin.app.fileManager.renameFile(file, newPath);

					// Update the file reference and task path
					movedFile = this.plugin.app.vault.getAbstractFileByPath(newPath) as TFile;
					updatedTask.path = newPath;

					// Clear old cache entry and update path in task object
					this.plugin.cacheManager.clearCacheEntry(task.path);
				} else if (isCurrentlyArchived && this.plugin.settings.tasksFolder?.trim()) {
					// Unarchiving: Move to default tasks folder
					const tasksFolder = this.plugin.settings.tasksFolder.trim();

					// Ensure tasks folder exists
					await ensureFolderExists(this.plugin.app.vault, tasksFolder);

					// Construct new path in tasks folder
					const newPath = `${tasksFolder}/${file.name}`;

					// Check if file already exists at destination
					const existingFile = this.plugin.app.vault.getAbstractFileByPath(newPath);
					if (existingFile) {
						throw new Error(
							`A file named "${file.name}" already exists in the tasks folder "${tasksFolder}". Cannot move task to avoid overwriting existing file.`
						);
					}

					// Move the file
					await this.plugin.app.fileManager.renameFile(file, newPath);

					// Update the file reference and task path
					movedFile = this.plugin.app.vault.getAbstractFileByPath(newPath) as TFile;
					updatedTask.path = newPath;

					// Clear old cache entry and update path in task object
					this.plugin.cacheManager.clearCacheEntry(task.path);
				}
			} catch (moveError) {
				// If moving fails, show error but don't break the archive operation
				const errorMessage =
					moveError instanceof Error ? moveError.message : String(moveError);
				const operation = isCurrentlyArchived ? "unarchiving" : "archiving";
				console.error(`Error moving ${operation} task:`, errorMessage);
				new Notice(
					this.translate("services.task.notices.moveTaskFailed", {
						operation,
						error: errorMessage,
					})
				);
				// Continue with archive operation without moving the file
			}
		}

		// Step 3: Wait for fresh data and update cache
		try {
			// Wait for the metadata cache to have the updated data
			if (movedFile instanceof TFile && this.plugin.cacheManager.waitForFreshTaskData) {
				await this.plugin.cacheManager.waitForFreshTaskData(movedFile);
			}
			this.plugin.cacheManager.updateTaskInfoInCache(updatedTask.path, updatedTask);
		} catch (cacheError) {
			console.error("Error updating cache for archived task:", cacheError);
		}

		// Step 4: Notify system of change
		this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
			path: updatedTask.path,
			originalTask: task,
			updatedTask: updatedTask,
		});

		// Trigger webhook for archive/unarchive
		if (this.webhookNotifier) {
			try {
				if (updatedTask.archived) {
					await this.webhookNotifier.triggerWebhook("task.archived", {
						task: updatedTask,
					});
				} else {
					await this.webhookNotifier.triggerWebhook("task.unarchived", {
						task: updatedTask,
					});
				}
			} catch (error) {
				console.warn("Failed to trigger webhook for task archive/unarchive:", error);
			}
		}

		// Sync to Google Calendar if enabled
		// Archiving removes from calendar (archived tasks aren't synced)
		// Unarchiving may re-add to calendar
		if (this.plugin.taskCalendarSyncService?.isEnabled()) {
			if (updatedTask.archived && task.googleCalendarEventId) {
				// Task is being archived - delete the calendar event
				this.plugin.taskCalendarSyncService
					.deleteTaskFromCalendar(updatedTask)
					.catch((error) => {
						console.warn("Failed to delete archived task from Google Calendar:", error);
					});
			} else if (!updatedTask.archived) {
				// Task is being unarchived - sync it back if eligible
				this.plugin.taskCalendarSyncService
					.updateTaskInCalendar(updatedTask, task)
					.catch((error) => {
						console.warn("Failed to sync unarchived task to Google Calendar:", error);
					});
			}
		}

		// Step 5: Return authoritative data
		return updatedTask;
	}

	/**
	 * Start time tracking for a task
	 */
	async startTimeTracking(task: TaskInfo): Promise<TaskInfo> {
		const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
		if (!(file instanceof TFile)) {
			throw new Error(`Cannot find task file: ${task.path}`);
		}

		// Check if already tracking
		const activeSession = this.plugin.getActiveTimeSession(task);
		if (activeSession) {
			throw new Error("Time tracking is already active for this task");
		}

		// Step 1: Construct new state in memory
		const updatedTask = { ...task };
		updatedTask.dateModified = getCurrentTimestamp();

		if (!updatedTask.timeEntries) {
			updatedTask.timeEntries = [];
		}
		updatedTask.timeEntries = updatedTask.timeEntries.map((entry) => {
			const sanitizedEntry = { ...entry };
			delete sanitizedEntry.duration;
			return sanitizedEntry;
		});

		const newEntry: TimeEntry = {
			startTime: new Date().toISOString(),
			description: "Work session",
		};
		updatedTask.timeEntries = [...updatedTask.timeEntries, newEntry];

		// Step 2: Persist to file
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const timeEntriesField = this.plugin.fieldMapper.toUserField("timeEntries");
			const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");

			if (!frontmatter[timeEntriesField]) {
				frontmatter[timeEntriesField] = [];
			}
			if (Array.isArray(frontmatter[timeEntriesField])) {
				frontmatter[timeEntriesField] = frontmatter[timeEntriesField].map((entry: TimeEntry) => {
					const sanitizedEntry = { ...entry };
					delete sanitizedEntry.duration;
					return sanitizedEntry;
				});
			}

			// Add new time entry with start time
			frontmatter[timeEntriesField].push(newEntry);
			frontmatter[dateModifiedField] = updatedTask.dateModified;
		});

		// Step 3: Wait for fresh data and update cache
		try {
			// Wait for the metadata cache to have the updated time entries
			if (this.plugin.cacheManager.waitForFreshTaskData) {
				await this.plugin.cacheManager.waitForFreshTaskData(file);
			}
			this.plugin.cacheManager.updateTaskInfoInCache(task.path, updatedTask);
		} catch (cacheError) {
			console.error("Error updating cache for time tracking start:", cacheError);
		}

		// Step 4: Notify system of change
		this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
			path: task.path,
			originalTask: task,
			updatedTask: updatedTask,
		});

		// Trigger webhook for time tracking start
		if (this.webhookNotifier) {
			try {
				await this.webhookNotifier.triggerWebhook("time.started", {
					task: updatedTask,
					session: updatedTask.timeEntries?.[updatedTask.timeEntries.length - 1],
				});
			} catch (error) {
				console.warn("Failed to trigger webhook for time tracking start:", error);
			}
		}

		// Step 5: Return authoritative data
		return updatedTask;
	}

	/**
	 * Stop time tracking for a task
	 */
	async stopTimeTracking(task: TaskInfo): Promise<TaskInfo> {
		const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
		if (!(file instanceof TFile)) {
			throw new Error(`Cannot find task file: ${task.path}`);
		}

		const activeSession = this.plugin.getActiveTimeSession(task);
		if (!activeSession) {
			throw new Error("No active time tracking session for this task");
		}
		const stopTimestamp = new Date().toISOString();

		// Step 1: Construct new state in memory
		const updatedTask = { ...task };
		updatedTask.dateModified = getCurrentTimestamp();

		if (updatedTask.timeEntries && Array.isArray(updatedTask.timeEntries)) {
			updatedTask.timeEntries = updatedTask.timeEntries.map((entry) => {
				const sanitizedEntry = { ...entry };
				delete sanitizedEntry.duration;
				return sanitizedEntry;
			});
			const entryIndex = updatedTask.timeEntries.findIndex(
				(entry: TimeEntry) => entry.startTime === activeSession.startTime && !entry.endTime
			);
			if (entryIndex !== -1) {
				updatedTask.timeEntries = [...updatedTask.timeEntries];
				updatedTask.timeEntries[entryIndex] = {
					...updatedTask.timeEntries[entryIndex],
					endTime: stopTimestamp,
				};
			}
		}

		// Step 2: Persist to file
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const timeEntriesField = this.plugin.fieldMapper.toUserField("timeEntries");
			const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");

			if (frontmatter[timeEntriesField] && Array.isArray(frontmatter[timeEntriesField])) {
				frontmatter[timeEntriesField] = frontmatter[timeEntriesField].map((entry: TimeEntry) => {
					const sanitizedEntry = { ...entry };
					delete sanitizedEntry.duration;
					return sanitizedEntry;
				});
				// Find and update the active session
				const entryIndex = frontmatter[timeEntriesField].findIndex(
					(entry: TimeEntry) =>
						entry.startTime === activeSession.startTime && !entry.endTime
				);

				if (entryIndex !== -1) {
					frontmatter[timeEntriesField][entryIndex].endTime = stopTimestamp;
				}
			}
			frontmatter[dateModifiedField] = updatedTask.dateModified;
		});

		// Step 3: Wait for fresh data and update cache
		try {
			// Wait for the metadata cache to have the updated time entries
			if (this.plugin.cacheManager.waitForFreshTaskData) {
				await this.plugin.cacheManager.waitForFreshTaskData(file);
			}
			this.plugin.cacheManager.updateTaskInfoInCache(task.path, updatedTask);
		} catch (cacheError) {
			console.error("Error updating cache for time tracking stop:", cacheError);
		}

		// Step 4: Notify system of change
		this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
			path: task.path,
			originalTask: task,
			updatedTask: updatedTask,
		});

		// Trigger webhook for time tracking stop
		if (this.webhookNotifier) {
			try {
				await this.webhookNotifier.triggerWebhook("time.stopped", {
					task: updatedTask,
					session: updatedTask.timeEntries?.[updatedTask.timeEntries.length - 1],
				});
			} catch (error) {
				console.warn("Failed to trigger webhook for time tracking stop:", error);
			}
		}

		// Step 5: Return authoritative data
		return updatedTask;
	}

	/**
	 * Update a task with multiple property changes following the deterministic data flow pattern
	 * This is the centralized method for bulk task updates used by the TaskEditModal
	 */
	async updateTask(
		originalTask: TaskInfo,
		updates: Partial<TaskInfo> & { details?: string }
	): Promise<TaskInfo> {
		try {
			const file = this.plugin.app.vault.getAbstractFileByPath(originalTask.path);
			if (!(file instanceof TFile)) {
				throw new Error(`Cannot find task file: ${originalTask.path}`);
			}

			if (Array.isArray(updates.timeEntries)) {
				updates.timeEntries = updates.timeEntries.map((entry) => {
					const sanitizedEntry = { ...entry };
					delete sanitizedEntry.duration;
					return sanitizedEntry;
				});
			}

			const isRenameNeeded =
				this.plugin.settings.storeTitleInFilename &&
				updates.title &&
				updates.title !== originalTask.title;
			let newPath = originalTask.path;

			if (isRenameNeeded) {
				const parentPath = file.parent ? file.parent.path : "";
				const newFilename = await generateUniqueFilename(
					updates.title!,
					parentPath,
					this.plugin.app.vault
				);
				newPath = parentPath ? `${parentPath}/${newFilename}.md` : `${newFilename}.md`;
			}

			// Check if recurrence rule changed and update scheduled date if needed
			let recurrenceUpdates: Partial<TaskInfo> = {};
			if (
				updates.recurrence !== undefined &&
				updates.recurrence !== originalTask.recurrence
			) {
				// Recurrence rule changed, calculate new scheduled date
				const tempTask: TaskInfo = { ...originalTask, ...updates };
				const nextDates = updateToNextScheduledOccurrence(
					tempTask,
					this.plugin.settings.maintainDueDateOffsetInRecurring
				);
				if (nextDates.scheduled) {
					recurrenceUpdates.scheduled = nextDates.scheduled;
				}
				if (nextDates.due) {
					recurrenceUpdates.due = nextDates.due;
				}

				// Add DTSTART to recurrence rule if it's missing (scenario 1: editing recurrence rule)
				if (
					typeof updates.recurrence === "string" &&
					updates.recurrence &&
					!updates.recurrence.includes("DTSTART:")
				) {
					const tempTaskWithRecurrence: TaskInfo = {
						...originalTask,
						...updates,
						...recurrenceUpdates,
					};
					const updatedRecurrence = addDTSTARTToRecurrenceRule(tempTaskWithRecurrence);
					if (updatedRecurrence) {
						recurrenceUpdates.recurrence = updatedRecurrence;
					}
				}
			} else if (
				updates.recurrence !== undefined &&
				!originalTask.recurrence &&
				updates.recurrence
			) {
				// Scenario 2: Converting non-recurring to recurring task
				if (
					typeof updates.recurrence === "string" &&
					!updates.recurrence.includes("DTSTART:")
				) {
					const tempTask: TaskInfo = { ...originalTask, ...updates };
					const updatedRecurrence = addDTSTARTToRecurrenceRule(tempTask);
					if (updatedRecurrence) {
						recurrenceUpdates.recurrence = updatedRecurrence;
					}
				}
			}

			// Scenario 3: Scheduled date update for recurring tasks
			if (
				updates.scheduled !== undefined &&
				updates.scheduled !== originalTask.scheduled &&
				originalTask.recurrence
			) {
				if (
					typeof originalTask.recurrence === "string" &&
					!originalTask.recurrence.includes("DTSTART:")
				) {
					const tempTask: TaskInfo = { ...originalTask, ...updates };
					const updatedRecurrence = addDTSTARTToRecurrenceRule(tempTask);
					if (updatedRecurrence) {
						recurrenceUpdates.recurrence = updatedRecurrence;
					}
				}
			}

			// Step 1: Persist frontmatter changes to the file at its original path
			let normalizedDetails: string | null = null;
			if (Object.prototype.hasOwnProperty.call(updates, "details")) {
				normalizedDetails =
					typeof updates.details === "string"
						? updates.details.replace(/\r\n/g, "\n")
						: "";
			}

			await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
				const completeTaskData: Partial<TaskInfo> = {
					...originalTask,
					...updates,
					...recurrenceUpdates,
					dateModified: getCurrentTimestamp(),
				};

				const mappedFrontmatter = this.plugin.fieldMapper.mapToFrontmatter(
					completeTaskData,
					this.plugin.settings.taskIdentificationMethod === "tag"
						? this.plugin.settings.taskTag
						: undefined,
					this.plugin.settings.storeTitleInFilename
				);

				Object.keys(mappedFrontmatter).forEach((key) => {
					if (mappedFrontmatter[key] !== undefined) {
						frontmatter[key] = mappedFrontmatter[key];
					}
				});

				// Handle completedDate for status changes (non-recurring tasks only)
				if (updates.status !== undefined) {
					this.updateCompletedDateInFrontmatter(frontmatter, updates.status, !!originalTask.recurrence);
				}

				// Handle task identification based on settings
				if (this.plugin.settings.taskIdentificationMethod === "property") {
					const propName = this.plugin.settings.taskPropertyName;
					const propValue = this.plugin.settings.taskPropertyValue;
					if (propName && propValue) {
						// Coerce boolean-like strings to actual booleans for compatibility with Obsidian properties
						const lower = propValue.toLowerCase();
						const coercedValue =
							lower === "true" || lower === "false" ? lower === "true" : propValue;
						frontmatter[propName] = coercedValue as any;
					}
				}

				// Handle custom frontmatter properties (including user fields)
				if ((updates as any).customFrontmatter) {
					Object.keys((updates as any).customFrontmatter).forEach((key) => {
						const value = (updates as any).customFrontmatter[key];
						if (value === null) {
							// Remove the property if value is null
							delete frontmatter[key];
						} else {
							// Set the property value
							frontmatter[key] = value;
						}
					});
				}

				if (updates.hasOwnProperty("due") && updates.due === undefined)
					delete frontmatter[this.plugin.fieldMapper.toUserField("due")];
				if (updates.hasOwnProperty("scheduled") && updates.scheduled === undefined)
					delete frontmatter[this.plugin.fieldMapper.toUserField("scheduled")];
				if (updates.hasOwnProperty("contexts") && updates.contexts === undefined)
					delete frontmatter[this.plugin.fieldMapper.toUserField("contexts")];
				if (updates.hasOwnProperty("projects")) {
					const projectsField = this.plugin.fieldMapper.toUserField("projects");
					const projectsToSet = Array.isArray(updates.projects) ? updates.projects : [];
					if (projectsToSet.length > 0) {
						frontmatter[projectsField] = projectsToSet;
					} else {
						delete frontmatter[projectsField];
					}
				}
				if (updates.hasOwnProperty("timeEstimate") && updates.timeEstimate === undefined)
					delete frontmatter[this.plugin.fieldMapper.toUserField("timeEstimate")];
				if (updates.hasOwnProperty("completedDate") && updates.completedDate === undefined)
					delete frontmatter[this.plugin.fieldMapper.toUserField("completedDate")];
				if (updates.hasOwnProperty("recurrence") && updates.recurrence === undefined)
					delete frontmatter[this.plugin.fieldMapper.toUserField("recurrence")];
				if (updates.hasOwnProperty("blockedBy") && updates.blockedBy === undefined)
					delete frontmatter[this.plugin.fieldMapper.toUserField("blockedBy")];

				if (isRenameNeeded) {
					delete frontmatter[this.plugin.fieldMapper.toUserField("title")];
				}

				if (updates.hasOwnProperty("tags")) {
					const tagsToSet = Array.isArray(updates.tags) ? [...updates.tags] : [];
					if (tagsToSet.length > 0) {
						frontmatter.tags = tagsToSet;
					} else {
						delete frontmatter.tags;
					}
				}
			});

			// Step 2: Rename the file if needed, after frontmatter is updated
			if (isRenameNeeded) {
				await this.plugin.app.fileManager.renameFile(file, newPath);
			}

			// Step 2b: Update body content if details changed
			if (normalizedDetails !== null) {
				const targetFile = this.plugin.app.vault.getAbstractFileByPath(newPath);
				if (targetFile instanceof TFile) {
					const currentContent = await this.plugin.app.vault.read(targetFile);
					const { frontmatter: frontmatterText } =
						splitFrontmatterAndBody(currentContent);
					const frontmatterBlock =
						frontmatterText !== null ? `---\n${frontmatterText}\n---\n\n` : "";
					const bodyContent = normalizedDetails.trimEnd();
					const finalBody = bodyContent.length > 0 ? `${bodyContent}\n` : "";
					await this.plugin.app.vault.modify(
						targetFile,
						`${frontmatterBlock}${finalBody}`
					);
				}
			}

			// Step 3: Construct the final authoritative state
			const updatedTask: TaskInfo = {
				...originalTask,
				...updates,
				...recurrenceUpdates,
				path: newPath,
				dateModified: getCurrentTimestamp(),
			};

			if (normalizedDetails !== null) {
				updatedTask.details = normalizedDetails;
			}

			if (updates.status !== undefined && !originalTask.recurrence) {
				if (this.plugin.statusManager.isCompletedStatus(updates.status)) {
					if (!originalTask.completedDate) {
						updatedTask.completedDate = getCurrentDateString();
					}
				} else {
					updatedTask.completedDate = undefined;
				}
			}

			// Step 4: Wait for fresh data and update cache
			if (isRenameNeeded) {
				this.plugin.cacheManager.clearCacheEntry(originalTask.path);
			}
			try {
				// Wait for the metadata cache to have the updated data
				const finalFile = this.plugin.app.vault.getAbstractFileByPath(newPath);
				if (finalFile instanceof TFile && this.plugin.cacheManager.waitForFreshTaskData) {
					// Wait for key changes to be reflected
					const keyChanges: Partial<TaskInfo> = {};
					if (updates.title !== undefined) keyChanges.title = updates.title;
					if (updates.status !== undefined) keyChanges.status = updates.status;
					if (updates.priority !== undefined) keyChanges.priority = updates.priority;
					if (Object.keys(keyChanges).length > 0) {
						await this.plugin.cacheManager.waitForFreshTaskData(finalFile);
					}
				}
				this.plugin.cacheManager.updateTaskInfoInCache(newPath, updatedTask);
			} catch (cacheError) {
				// Cache errors shouldn't break the operation, just log them
				// eslint-disable-next-line no-console
				console.error("Error updating task cache:", {
					error: cacheError instanceof Error ? cacheError.message : String(cacheError),
					taskPath: newPath,
				});
			}

			// Step 5: Notify system of change
			try {
				this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
					path: newPath,
					originalTask: originalTask,
					updatedTask: updatedTask,
				});
			} catch (eventError) {
				// eslint-disable-next-line no-console
				console.error("Error emitting task update event:", {
					error: eventError instanceof Error ? eventError.message : String(eventError),
					taskPath: newPath,
				});
				// Event emission errors shouldn't break the operation
			}

			// Trigger webhooks for task update/completion
			if (this.webhookNotifier) {
				try {
					// Check if this was a completion
					const wasCompleted = this.plugin.statusManager.isCompletedStatus(
						originalTask.status
					);
					const isCompleted = this.plugin.statusManager.isCompletedStatus(
						updatedTask.status
					);

					if (!wasCompleted && isCompleted) {
						// Task was completed
						await this.webhookNotifier.triggerWebhook("task.completed", {
							task: updatedTask,
						});
					} else {
						// Regular update
						await this.webhookNotifier.triggerWebhook("task.updated", {
							task: updatedTask,
							previous: originalTask,
						});
					}
				} catch (error) {
					console.warn("Failed to trigger webhook for task update:", error);
				}
			}

			// Sync to Google Calendar if enabled (fire-and-forget to avoid blocking modal)
			if (this.plugin.taskCalendarSyncService?.isEnabled()) {
				const wasCompleted = this.plugin.statusManager.isCompletedStatus(
					originalTask.status
				);
				const isCompleted = this.plugin.statusManager.isCompletedStatus(
					updatedTask.status
				);

				const syncPromise =
					!wasCompleted && isCompleted
						? this.plugin.taskCalendarSyncService.completeTaskInCalendar(updatedTask)
						: this.plugin.taskCalendarSyncService.updateTaskInCalendar(
							updatedTask,
							originalTask
						);

				syncPromise.catch((error) => {
					console.warn("Failed to sync task update to Google Calendar:", error);
				});
			}

			// Handle auto-archive if status changed
			if (
				this.autoArchiveService &&
				updates.status !== undefined &&
				updates.status !== originalTask.status
			) {
				try {
					const statusConfig = this.plugin.statusManager.getStatusConfig(
						updatedTask.status
					);
					if (statusConfig) {
						if (statusConfig.autoArchive) {
							// Schedule for auto-archive
							await this.autoArchiveService.scheduleAutoArchive(
								updatedTask,
								statusConfig
							);
						} else {
							// Cancel any pending auto-archive since new status doesn't have auto-archive
							await this.autoArchiveService.cancelAutoArchive(updatedTask.path);
						}
					}
				} catch (error) {
					console.warn("Failed to handle auto-archive for status change:", error);
				}
			}

			return updatedTask;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("Error updating task:", {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				taskPath: originalTask.path,
				updates,
			});

			throw new Error(`Failed to update task: ${errorMessage}`);
		}
	}

	async updateBlockingRelationships(
		currentTask: TaskInfo,
		addedBlockedTaskPaths: string[],
		removedBlockedTaskPaths: string[],
		rawEntries: Record<string, TaskDependency | string> = {}
	): Promise<void> {
		// This method is called when the current task's "blocking" list is updated in the UI.
		// The current task is the one blocking other tasks.
		// We need to update the blockedBy field of the tasks that this task is blocking.

		const uniqueRemovals = Array.from(new Set(removedBlockedTaskPaths));
		const uniqueAdditions = Array.from(new Set(addedBlockedTaskPaths));

		// Remove current task from the blockedBy field of tasks it's no longer blocking
		for (const blockedTaskPath of uniqueRemovals) {
			const blockedTask = await this.plugin.cacheManager.getTaskInfo(blockedTaskPath);
			if (!blockedTask) {
				continue;
			}

			const updatedBlockedBy = this.computeBlockedByUpdate(
				blockedTask,
				currentTask.path,
				"remove"
			);
			if (updatedBlockedBy === null) {
				continue;
			}

			const updates: Partial<TaskInfo> = {
				blockedBy: updatedBlockedBy.length > 0 ? updatedBlockedBy : undefined,
			};
			await this.updateTask(blockedTask, updates);
		}

		// Add current task to the blockedBy field of tasks it's now blocking
		for (const blockedTaskPath of uniqueAdditions) {
			const blockedTask = await this.plugin.cacheManager.getTaskInfo(blockedTaskPath);
			if (!blockedTask) {
				continue;
			}

			// Don't use the raw entry from the UI since it was created relative to the current task's path
			// Instead, always generate a new link from the blocked task's perspective
			const updatedBlockedBy = this.computeBlockedByUpdate(
				blockedTask,
				currentTask.path,
				"add",
				rawEntries[blockedTaskPath]
			);
			if (updatedBlockedBy === null) {
				continue;
			}

			await this.updateTask(blockedTask, { blockedBy: updatedBlockedBy });
		}
	}

	private computeBlockedByUpdate(
		blockedTask: TaskInfo,
		blockingTaskPath: string,
		action: "add" | "remove",
		rawEntry?: TaskDependency | string
	): TaskDependency[] | null {
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
			const resolved = resolveDependencyEntry(this.plugin.app, blockedTask.path, entry);
			if (resolved && resolved.path === blockingTaskPath) {
				hasExistingEntry = true;
				if (action === "remove") {
					modified = true;
					continue; // skip to remove
				}
			}
			result.push(entry);
		}

		if (action === "add" && !hasExistingEntry) {
			const normalizedIncoming = rawEntry ? normalizeDependencyEntry(rawEntry) : null;
			const uid = formatDependencyLink(this.plugin.app, blockedTask.path, blockingTaskPath, this.plugin.settings.useFrontmatterMarkdownLinks);
			const dependency: TaskDependency = {
				uid,
				reltype: normalizedIncoming?.reltype ?? DEFAULT_DEPENDENCY_RELTYPE,
			};
			if (normalizedIncoming?.gap) {
				dependency.gap = normalizedIncoming.gap;
			}
			result.push(dependency);
			modified = true;
		}

		if (!modified) {
			return null;
		}

		return result;
	}

	/**
	 * Delete a task file and remove it from all caches and indexes
	 */
	async deleteTask(task: TaskInfo): Promise<void> {
		try {
			const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
			if (!(file instanceof TFile)) {
				throw new Error(`Cannot find task file: ${task.path}`);
			}

			// Delete from Google Calendar first (before file deletion, so we have the event ID)
			if (this.plugin.taskCalendarSyncService?.isEnabled() && task.googleCalendarEventId) {
				try {
					await this.plugin.taskCalendarSyncService
						.deleteTaskFromCalendarByPath(task.path, task.googleCalendarEventId);
				} catch (error) {
					console.warn("Failed to delete task from Google Calendar:", error);
				}
			}

			// Step 1: Delete the file from the vault
			await this.plugin.app.vault.delete(file);

			// Step 2: Remove from cache and indexes (this will be done by the file delete event)
			// But we'll also do it proactively to ensure immediate UI updates
			this.plugin.cacheManager.clearCacheEntry(task.path);

			// Step 3: Emit task deleted event
			this.plugin.emitter.trigger(EVENT_TASK_DELETED, {
				path: task.path,
				deletedTask: task,
			});

			// Trigger webhook for task deletion
			if (this.webhookNotifier) {
				try {
					await this.webhookNotifier.triggerWebhook("task.deleted", { task });
				} catch (error) {
					console.warn("Failed to trigger webhook for task deletion:", error);
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			// eslint-disable-next-line no-console
			console.error("Error deleting task:", {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				taskPath: task.path,
			});

			throw new Error(`Failed to delete task: ${errorMessage}`);
		}
	}

	/**
	 * Toggle completion status for recurring tasks on a specific date
	 */
	async toggleRecurringTaskComplete(task: TaskInfo, date?: Date): Promise<TaskInfo> {
		const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
		if (!(file instanceof TFile)) {
			throw new Error(`Cannot find task file: ${task.path}`);
		}

		// Get fresh task data to ensure we have the latest completion state
		const freshTask = (await this.plugin.cacheManager.getTaskInfo(task.path)) || task;

		if (!freshTask.recurrence) {
			throw new Error("Task is not recurring");
		}

		// Default to local today instead of selectedDate for recurring task completion
		// This ensures completion is recorded for user's actual calendar day unless explicitly overridden
		const targetDate =
			date ||
			(() => {
				const todayLocal = getTodayLocal();
				return createUTCDateFromLocalCalendarDate(todayLocal);
			})();
		const dateStr = formatDateForStorage(targetDate);

		// Check current completion status for this date using fresh data
		const completeInstances = Array.isArray(freshTask.complete_instances)
			? freshTask.complete_instances
			: [];
		const currentComplete = completeInstances.includes(dateStr);
		const newComplete = !currentComplete;

		// Step 1: Construct new state in memory using fresh data
		const updatedTask = { ...freshTask };
		updatedTask.dateModified = getCurrentTimestamp();

		if (newComplete) {
			// Add date to completed instances if not already present
			if (!completeInstances.includes(dateStr)) {
				updatedTask.complete_instances = [...completeInstances, dateStr];
			}
			// Remove from skipped_instances if present (can't be both completed and skipped)
			const skippedInstances = Array.isArray(freshTask.skipped_instances)
				? freshTask.skipped_instances
				: [];
			updatedTask.skipped_instances = skippedInstances.filter((d) => d !== dateStr);
		} else {
			// Remove date from completed instances
			updatedTask.complete_instances = completeInstances.filter((d) => d !== dateStr);
			// Also remove from skipped_instances (marking as incomplete)
			const skippedInstances = Array.isArray(freshTask.skipped_instances)
				? freshTask.skipped_instances
				: [];
			updatedTask.skipped_instances = skippedInstances.filter((d) => d !== dateStr);
		}

		// Handle DTSTART in recurrence rule when completing
		if (newComplete && typeof updatedTask.recurrence === "string") {
			const recurrenceAnchor = updatedTask.recurrence_anchor || "scheduled";

			if (recurrenceAnchor === "completion") {
				// For completion-based recurrence, update DTSTART to the completion date
				// This shifts the anchor point so future occurrences calculate from this completion
				const updatedRecurrence = updateDTSTARTInRecurrenceRule(
					updatedTask.recurrence,
					dateStr
				);
				if (updatedRecurrence) {
					updatedTask.recurrence = updatedRecurrence;
				}
			} else if (!updatedTask.recurrence.includes("DTSTART:")) {
				// For scheduled-based recurrence, just add DTSTART if missing (preserves original anchor)
				const updatedRecurrence = addDTSTARTToRecurrenceRule(updatedTask);
				if (updatedRecurrence) {
					updatedTask.recurrence = updatedRecurrence;
				}
			}
		}

		// Update scheduled date to next uncompleted occurrence
		const nextDates = updateToNextScheduledOccurrence(
			updatedTask,
			this.plugin.settings.maintainDueDateOffsetInRecurring
		);
		if (nextDates.scheduled) {
			updatedTask.scheduled = nextDates.scheduled;
		}
		if (nextDates.due) {
			updatedTask.due = nextDates.due;
		}

		// Step 2: Persist to file
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const completeInstancesField = this.plugin.fieldMapper.toUserField("completeInstances");
			const skippedInstancesField = this.plugin.fieldMapper.toUserField("skippedInstances");
			const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");
			const scheduledField = this.plugin.fieldMapper.toUserField("scheduled");
			const dueField = this.plugin.fieldMapper.toUserField("due");
			const recurrenceField = this.plugin.fieldMapper.toUserField("recurrence");

			// Ensure complete_instances array exists
			if (!frontmatter[completeInstancesField]) {
				frontmatter[completeInstancesField] = [];
			}

			// Ensure skipped_instances array exists
			if (!frontmatter[skippedInstancesField]) {
				frontmatter[skippedInstancesField] = [];
			}

			const completeDates: string[] = frontmatter[completeInstancesField];

			if (newComplete) {
				// Add date to completed instances if not already present
				if (!completeDates.includes(dateStr)) {
					frontmatter[completeInstancesField] = [...completeDates, dateStr];
				}
			} else {
				// Remove date from completed instances
				frontmatter[completeInstancesField] = completeDates.filter((d) => d !== dateStr);
			}

			// Update skipped_instances (remove when completing or marking incomplete)
			frontmatter[skippedInstancesField] = updatedTask.skipped_instances || [];

			// Update recurrence field if it was updated with DTSTART
			if (updatedTask.recurrence !== freshTask.recurrence) {
				frontmatter[recurrenceField] = updatedTask.recurrence;
			}

			// Update scheduled date if it changed
			if (updatedTask.scheduled) {
				frontmatter[scheduledField] = updatedTask.scheduled;
			}

			// Update due date if it changed
			if (updatedTask.due) {
				frontmatter[dueField] = updatedTask.due;
			}

			frontmatter[dateModifiedField] = updatedTask.dateModified;
		});

		// Step 2b: Reset checkboxes in task body when completing (if setting enabled)
		if (newComplete && this.plugin.settings.resetCheckboxesOnRecurrence) {
			const currentContent = await this.plugin.app.vault.read(file);
			const { frontmatter: frontmatterText, body } = splitFrontmatterAndBody(currentContent);
			const { content: resetBody, changed } = resetMarkdownCheckboxes(body);

			if (changed) {
				const frontmatterBlock =
					frontmatterText !== null ? `---\n${frontmatterText}\n---\n\n` : "";
				const finalBody = resetBody.trimEnd();
				const newContent = finalBody.length > 0 ? `${frontmatterBlock}${finalBody}\n` : frontmatterBlock;
				await this.plugin.app.vault.modify(file, newContent);

				// Update the details field in the returned task
				updatedTask.details = resetBody.replace(/\r\n/g, "\n").trimEnd();
			}
		}

		// Step 3: Wait for fresh data and update cache
		try {
			// Wait for the metadata cache to have the updated data
			if (this.plugin.cacheManager.waitForFreshTaskData) {
				const expectedChanges: Partial<TaskInfo> = {
					complete_instances: updatedTask.complete_instances,
				};
				if (updatedTask.scheduled !== freshTask.scheduled) {
					expectedChanges.scheduled = updatedTask.scheduled;
				}
				if (updatedTask.due !== freshTask.due) {
					expectedChanges.due = updatedTask.due;
				}
				await this.plugin.cacheManager.waitForFreshTaskData(file);
			}
			this.plugin.cacheManager.updateTaskInfoInCache(freshTask.path, updatedTask);
		} catch (cacheError) {
			console.error("Error updating cache for recurring task:", cacheError);
		}

		// Step 4: Notify system of change
		this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
			path: freshTask.path,
			originalTask: freshTask,
			updatedTask: updatedTask,
		});

		// Step 5: Trigger webhook for recurring task completion
		if (newComplete && this.webhookNotifier) {
			try {
				await this.webhookNotifier.triggerWebhook("recurring.instance.completed", {
					task: updatedTask,
					date: dateStr,
					targetDate: targetDate,
				});
			} catch (webhookError) {
				console.error("Error triggering recurring task completion webhook:", webhookError);
			}
		}

		// Step 6: Sync to Google Calendar if enabled (scheduled date changed)
		if (this.plugin.taskCalendarSyncService?.isEnabled()) {
			// Recurring task completion updates the scheduled date to next occurrence
			this.plugin.taskCalendarSyncService
				.updateTaskInCalendar(updatedTask, freshTask)
				.catch((error) => {
					console.warn("Failed to sync recurring task update to Google Calendar:", error);
				});
		}

		// Step 7: Return authoritative data
		return updatedTask;
	}

	/**
	 * Toggle a recurring task instance as skipped for a specific date
	 * Similar to toggleRecurringTaskComplete but uses skipped_instances array
	 *
	 * When skipping:
	 * - Adds date to skipped_instances
	 * - Removes date from complete_instances (if present)
	 * - Updates scheduled date to next uncompleted occurrence
	 *
	 * When unskipping:
	 * - Removes date from skipped_instances
	 * - Updates scheduled date back to this date (since it's now incomplete)
	 */
	async toggleRecurringTaskSkipped(task: TaskInfo, date?: Date): Promise<TaskInfo> {
		const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
		if (!(file instanceof TFile)) {
			throw new Error(`Cannot find task file: ${task.path}`);
		}

		// Get fresh task data to avoid stale data issues
		const freshTask = (await this.plugin.cacheManager.getTaskInfo(task.path)) || task;

		if (!freshTask.recurrence) {
			throw new Error("Task is not recurring");
		}

		// Default to local today
		const targetDate =
			date ||
			(() => {
				const todayLocal = getTodayLocal();
				return createUTCDateFromLocalCalendarDate(todayLocal);
			})();
		const dateStr = formatDateForStorage(targetDate);

		// Check current skip status for this date
		const skippedInstances = Array.isArray(freshTask.skipped_instances)
			? freshTask.skipped_instances
			: [];
		const currentlySkipped = skippedInstances.includes(dateStr);
		const newSkipped = !currentlySkipped;

		// Step 1: Construct new state in memory
		const updatedTask = { ...freshTask };
		updatedTask.dateModified = getCurrentTimestamp();

		if (newSkipped) {
			// Mark as skipped
			if (!skippedInstances.includes(dateStr)) {
				updatedTask.skipped_instances = [...skippedInstances, dateStr];
			}

			// Remove from complete_instances if present (can't be both)
			const completeInstances = Array.isArray(freshTask.complete_instances)
				? freshTask.complete_instances
				: [];
			updatedTask.complete_instances = completeInstances.filter((d) => d !== dateStr);
		} else {
			// Unskip
			updatedTask.skipped_instances = skippedInstances.filter((d) => d !== dateStr);
		}

		// Step 2: Update scheduled date to next uncompleted occurrence
		// (This will skip over both completed AND skipped instances)
		const nextDates = updateToNextScheduledOccurrence(
			updatedTask,
			this.plugin.settings.maintainDueDateOffsetInRecurring
		);
		if (nextDates.scheduled) {
			updatedTask.scheduled = nextDates.scheduled;
		}
		if (nextDates.due) {
			updatedTask.due = nextDates.due;
		}

		// Step 3: Persist to file
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const skippedField = this.plugin.fieldMapper.toUserField("skippedInstances");
			const completeField = this.plugin.fieldMapper.toUserField("completeInstances");
			const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");
			const scheduledField = this.plugin.fieldMapper.toUserField("scheduled");
			const dueField = this.plugin.fieldMapper.toUserField("due");

			// Ensure skipped_instances array exists
			if (!frontmatter[skippedField]) {
				frontmatter[skippedField] = [];
			}

			// Update skipped instances
			frontmatter[skippedField] = updatedTask.skipped_instances || [];

			// Update complete instances (in case we removed from it)
			if (!frontmatter[completeField]) {
				frontmatter[completeField] = [];
			}
			frontmatter[completeField] = updatedTask.complete_instances || [];

			// Update scheduled/due dates
			if (updatedTask.scheduled) {
				frontmatter[scheduledField] = updatedTask.scheduled;
			}
			if (updatedTask.due) {
				frontmatter[dueField] = updatedTask.due;
			}

			frontmatter[dateModifiedField] = updatedTask.dateModified;
		});

		// Step 4: Wait for fresh data and update cache
		try {
			if (this.plugin.cacheManager.waitForFreshTaskData) {
				await this.plugin.cacheManager.waitForFreshTaskData(file);
			}
			this.plugin.cacheManager.updateTaskInfoInCache(freshTask.path, updatedTask);
		} catch (cacheError) {
			console.error("Error updating cache for skipped recurring task:", cacheError);
		}

		// Step 5: Notify system of change
		this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
			path: freshTask.path,
			originalTask: freshTask,
			updatedTask: updatedTask,
		});

		// Step 6: Trigger webhook for skipped instance
		if (newSkipped && this.webhookNotifier) {
			try {
				await this.webhookNotifier.triggerWebhook("recurring.instance.skipped", {
					task: updatedTask,
					date: dateStr,
					targetDate: targetDate,
				});
			} catch (webhookError) {
				console.error("Error triggering recurring task skip webhook:", webhookError);
			}
		}

		// Step 7: Sync to Google Calendar if enabled (scheduled date changed)
		if (this.plugin.taskCalendarSyncService?.isEnabled()) {
			// Skipping a recurring task updates the scheduled date to next occurrence
			this.plugin.taskCalendarSyncService
				.updateTaskInCalendar(updatedTask, freshTask)
				.catch((error) => {
					console.warn("Failed to sync recurring task skip to Google Calendar:", error);
				});
		}

		// Step 8: Return authoritative data
		return updatedTask;
	}

	/**
	 * Delete a specific time entry from a task
	 */
	async deleteTimeEntry(task: TaskInfo, timeEntryIndex: number): Promise<TaskInfo> {
		const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
		if (!(file instanceof TFile)) {
			throw new Error(`Cannot find task file: ${task.path}`);
		}

		if (!task.timeEntries || !Array.isArray(task.timeEntries)) {
			throw new Error("Task has no time entries");
		}

		if (timeEntryIndex < 0 || timeEntryIndex >= task.timeEntries.length) {
			throw new Error("Invalid time entry index");
		}

		// Step 1: Construct new state in memory
		const updatedTask = { ...task };
		updatedTask.dateModified = getCurrentTimestamp();

		// Remove the time entry at the specified index
		updatedTask.timeEntries = task.timeEntries.filter((_, index) => index !== timeEntryIndex);

		// Step 2: Persist to file
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const timeEntriesField = this.plugin.fieldMapper.toUserField("timeEntries");
			const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");

			if (frontmatter[timeEntriesField] && Array.isArray(frontmatter[timeEntriesField])) {
				// Remove the time entry at the specified index
				frontmatter[timeEntriesField] = frontmatter[timeEntriesField].filter(
					(_: any, index: number) => index !== timeEntryIndex
				);
			}

			frontmatter[dateModifiedField] = updatedTask.dateModified;
		});

		// Step 3: Wait for fresh data and update cache
		try {
			// Wait for the metadata cache to have the updated time entries
			if (this.plugin.cacheManager.waitForFreshTaskData) {
				await this.plugin.cacheManager.waitForFreshTaskData(file);
			}
			this.plugin.cacheManager.updateTaskInfoInCache(task.path, updatedTask);
		} catch (cacheError) {
			console.error("Error updating cache for time entry deletion:", cacheError);
		}

		// Step 4: Notify system of change
		this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
			path: task.path,
			originalTask: task,
			updatedTask: updatedTask,
		});

		// Step 5: Return authoritative data
		return updatedTask;
	}

	/**
	 * Update the completedDate field in frontmatter based on the task's status.
	 * For non-recurring tasks:
	 * - Sets completedDate to current date when status becomes completed
	 * - Removes completedDate when status becomes incomplete
	 * For recurring tasks, this method does nothing (they don't use completedDate).
	 *
	 * @param frontmatter - The frontmatter object to modify
	 * @param newStatus - The new status value
	 * @param isRecurring - Whether the task is recurring
	 */
	private updateCompletedDateInFrontmatter(
		frontmatter: Record<string, any>,
		newStatus: string,
		isRecurring: boolean
	): void {
		if (isRecurring) {
			return; // Recurring tasks don't use completedDate
		}

		const completedDateField = this.plugin.fieldMapper.toUserField("completedDate");

		if (this.plugin.statusManager.isCompletedStatus(newStatus)) {
			frontmatter[completedDateField] = getCurrentDateString();
		} else {
			if (frontmatter[completedDateField]) {
				delete frontmatter[completedDateField];
			}
		}
	}

	/**
	 * Extract the basename from a project string, handling wikilink format
	 * Examples:
	 * - "[[projects/testContext/testProject/testProject Root]]" -> "testProject Root"
	 * - "[[path|display text]]" -> "display text"
	 * - "simple string" -> "simple string"
	 */
	private extractProjectBasename(project: string): string {
		return getProjectDisplayName(project, this.plugin.app);
	}
}
