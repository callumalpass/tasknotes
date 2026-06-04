import {
	EVENT_TASK_DELETED,
	EVENT_TASK_UPDATED,
	TaskCreationData,
	TaskDependency,
	TaskInfo,
	IWebhookNotifier,
} from "../types";
import {
	buildMaterializeOccurrencePlan,
	buildMaterializedOccurrenceCompletePlan,
	buildMaterializedOccurrenceSkipPlan,
	buildMaterializedOccurrenceUncompletePlan,
	buildMaterializedOccurrenceUnskipPlan,
	findMaterializedOccurrence,
	isMaterializedOccurrenceTask,
	taskInfoUpdatesToFrontmatterPatch,
} from "@tasknotes/model/operations";
import { AutoArchiveService } from "./AutoArchiveService";
import { TFile, normalizePath } from "obsidian";
import { TemplateData, processTemplate } from "../utils/templateProcessor";
import {
	ensureFolderExists,
	splitFrontmatterAndBody,
	resetMarkdownCheckboxes,
} from "../utils/helpers";
import { formatDependencyLink, resolveDependencyEntry } from "../utils/dependencyUtils";
import { generateLink, getProjectDisplayName, parseLinkToPath } from "../utils/linkUtils";
import {
	formatDateForStorage,
	getCurrentDateString,
	getCurrentTimestamp,
} from "../utils/dateUtils";
import { processFolderTemplate, TaskTemplateData } from "../utils/folderTemplateProcessor";

import TaskNotesPlugin from "../main";
import type { InterpolationValues, TranslationKey } from "../i18n";
import { TaskCreationService } from "./task-service/TaskCreationService";
import { publishUserNotice } from "../core/userNotices";
import { TaskUpdateService } from "./task-service/TaskUpdateService";
import { applyTaskCreationDefaults as applyTaskCreationDefaultsToData } from "./task-service/taskCreationDefaults";
import {
	sanitizeTaskTitleForFilename,
	sanitizeTaskTitleForStorage,
} from "./task-service/taskTitleSanitizer";
import { runTaskPropertyChangeSideEffects } from "./task-service/taskPropertyChangeSideEffects";
import {
	applyTaskPropertyFrontmatterChange,
	buildTaskPropertyUpdatePlan,
	updateCompletedDateFrontmatter,
} from "./task-service/taskPropertyUpdate";
import {
	applyTaskArchiveFrontmatterChange,
	buildTaskArchiveMovePlan,
	buildTaskArchiveState,
} from "./task-service/taskArchivePlanning";
import {
	applyDeleteTimeEntryFrontmatterChange,
	applyStartTimeTrackingFrontmatterChange,
	applyStopTimeTrackingFrontmatterChange,
	buildDeleteTimeEntryPlan,
	buildStartTimeTrackingPlan,
	buildStopTimeTrackingPlan,
} from "./task-service/taskTimeTrackingPlanning";
import {
	applyRecurringTaskCompleteFrontmatterChange,
	applyRecurringTaskSkippedFrontmatterChange,
	buildRecurringTaskCompletePlan,
	buildRecurringTaskSkippedPlan,
	getRecurringTaskActionDate,
} from "./task-service/taskRecurringPlanning";
import {
	applyGoogleCalendarRecurringExceptionCleanup,
	applyGoogleCalendarRecurringExceptionForScheduledChange,
} from "./task-service/googleCalendarRecurringExceptions";
import {
	buildBlockedByTaskUpdate,
	buildBlockingRelationshipPathChanges,
	computeBlockedByUpdate,
} from "./task-service/taskBlockingRelationships";
import { resolveTaskPropertyFrontmatterField } from "./task-service/taskPropertyFrontmatterField";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/TaskService" });

export class TaskService {
	private webhookNotifier?: IWebhookNotifier;
	private autoArchiveService?: AutoArchiveService;
	private readonly taskCreationService: TaskCreationService;
	private readonly taskUpdateService: TaskUpdateService;

	constructor(private plugin: TaskNotesPlugin) {
		this.taskCreationService = new TaskCreationService({
			runtime: this.plugin,
			webhookNotifier: this.webhookNotifier,
			applyTaskCreationDefaults: (taskData) =>
				Promise.resolve(applyTaskCreationDefaultsToData(taskData, this.plugin.settings)),
			applyTemplate: (taskData) => this.applyTemplate(taskData),
			processFolderTemplate: (folderTemplate, taskData, date) =>
				this.processFolderTemplate(folderTemplate, taskData, date),
			sanitizeTitleForFilename: sanitizeTaskTitleForFilename,
			sanitizeTitleForStorage: sanitizeTaskTitleForStorage,
		});
		this.taskUpdateService = new TaskUpdateService({
			runtime: this.plugin,
			webhookNotifier: this.webhookNotifier,
			autoArchiveService: this.autoArchiveService,
			updateCompletedDateInFrontmatter: (frontmatter, newStatus, isRecurring) =>
				this.updateCompletedDateInFrontmatter(frontmatter, newStatus, isRecurring),
		});
	}

	private hasGoogleCalendarLinks(task: TaskInfo): boolean {
		return Boolean(task.googleCalendarEventId || task.googleCalendarExceptionEventId);
	}

	private createArchiveCalendarDeletionTask(task: TaskInfo, updatedTask: TaskInfo): TaskInfo {
		return {
			...updatedTask,
			googleCalendarEventId: task.googleCalendarEventId,
			googleCalendarExceptionEventId: task.googleCalendarExceptionEventId,
			googleCalendarExceptionOriginalScheduled: task.googleCalendarExceptionOriginalScheduled,
			googleCalendarMovedOriginalDates: task.googleCalendarMovedOriginalDates
				? [...task.googleCalendarMovedOriginalDates]
				: undefined,
		};
	}

	private clearGoogleCalendarMetadata(task: TaskInfo): void {
		task.googleCalendarEventId = undefined;
		task.googleCalendarExceptionEventId = undefined;
		task.googleCalendarExceptionOriginalScheduled = undefined;
		task.googleCalendarMovedOriginalDates = undefined;
	}

	private writeOptionalFrontmatterField(
		frontmatter: Record<string, unknown>,
		fieldName: string,
		value: unknown
	): void {
		if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
			delete frontmatter[fieldName];
			return;
		}

		frontmatter[fieldName] = value;
	}

	private async deleteArchivedTaskFromCalendar(task: TaskInfo): Promise<boolean> {
		if (!this.plugin.taskCalendarSyncService) {
			return true;
		}

		const deleted = await this.plugin.taskCalendarSyncService.deleteTaskFromCalendar(task);
		if (deleted) {
			return true;
		}

		tasknotesLogger.warn(
			"Failed to delete archived task from Google Calendar during archive:",
			{
				category: "provider",
				operation: "delete-archived-task-google-calendar-archive",
				details: { taskPath: task.path, eventId: task.googleCalendarEventId },
			}
		);
		return false;
	}

	private translate(key: TranslationKey, variables?: InterpolationValues): string {
		return this.plugin.i18n.translate(key, variables);
	}

	/**
	 * Set webhook notifier for triggering webhook events
	 * Called after HTTPAPIService is initialized to avoid circular dependencies
	 */
	setWebhookNotifier(notifier: IWebhookNotifier): void {
		this.webhookNotifier = notifier;
		this.taskCreationService.setWebhookNotifier(notifier);
		this.taskUpdateService.setWebhookNotifier(notifier);
	}

	/**
	 * Set auto-archive service for handling automatic archiving
	 */
	setAutoArchiveService(service: AutoArchiveService): void {
		this.autoArchiveService = service;
		this.taskUpdateService.setAutoArchiveService(service);
	}

	private normalizeStatusValue(value: unknown): string {
		if (typeof value === "boolean") return value ? "true" : "false";
		if (typeof value === "string") return value;
		if (typeof value === "number") return String(value);
		return "";
	}

	private getCompletionDateForTask(task: TaskInfo): string {
		return task.occurrence_date || getCurrentDateString();
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
			extractProjectFilePath: (project) => this.extractProjectFilePath(project),
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
		return this.taskCreationService.createTask(taskData, options);
	}

	/**
	 * Apply template to task (both frontmatter and body) if enabled in settings
	 */
	private async applyTemplate(
		taskData: TaskCreationData
	): Promise<{ frontmatter: Record<string, unknown>; body: string }> {
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

				tasknotesLogger.warn(`Task body template not found: ${templatePath}`, {
					category: "persistence",
					operation: "task-body-template-not-found",
				});
				publishUserNotice(
					this.plugin.emitter,
					this.translate("services.task.notices.templateNotFound", { path: templatePath })
				);
				return {
					frontmatter: {},
					body: taskData.details?.trim() || "",
				};
			}
		} catch (error) {
			// Error reading template, log error and return details as-is
			tasknotesLogger.error("Error reading task body template:", {
				category: "persistence",
				operation: "reading-task-body-template",
				error: error,
			});
			publishUserNotice(
				this.plugin.emitter,
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
			tasknotesLogger.error("Error toggling task status:", {
				category: "persistence",
				operation: "toggling-task-status",
				details: {
					stack: error instanceof Error ? error.stack : undefined,
					taskPath: task.path,
					currentStatus: task.status,
				},
				error: errorMessage,
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
		value: unknown,
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
			const updatePlan = buildTaskPropertyUpdatePlan({
				freshTask,
				property,
				value,
				currentTimestamp: getCurrentTimestamp(),
				currentDateString: this.getCompletionDateForTask(freshTask),
				normalizeStatusValue: (candidate) => this.normalizeStatusValue(candidate),
				isCompletedStatus: (status) => this.plugin.statusManager.isCompletedStatus(status),
			});

			if (property === "scheduled") {
				applyGoogleCalendarRecurringExceptionForScheduledChange(
					freshTask,
					updatePlan.normalizedValue,
					updatePlan.updatedTask
				);
			}
			if (property === "recurrence" || property === "recurrence_anchor") {
				applyGoogleCalendarRecurringExceptionCleanup(updatePlan.updatedTask);
			}

			// Step 2: Persist to file
			await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
				// Use field mapper to get the correct frontmatter property name
				const fieldName = resolveTaskPropertyFrontmatterField(
					this.plugin.fieldMapper,
					property
				);
				const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");
				const completedDateField = this.plugin.fieldMapper.toUserField("completedDate");
				applyTaskPropertyFrontmatterChange({
					frontmatter,
					property,
					fieldName,
					rawValue: value,
					normalizedValue: updatePlan.normalizedValue,
					dateModified: updatePlan.dateModified,
					dateModifiedField,
					completedDateField,
					isRecurring: !!freshTask.recurrence,
					normalizeStatusValue: (candidate) => this.normalizeStatusValue(candidate),
					isCompletedStatus: (status) =>
						this.plugin.statusManager.isCompletedStatus(status),
					currentDateString: this.getCompletionDateForTask(freshTask),
				});

				this.writeOptionalFrontmatterField(
					frontmatter,
					this.plugin.fieldMapper.toUserField("googleCalendarExceptionOriginalScheduled"),
					updatePlan.updatedTask.googleCalendarExceptionOriginalScheduled
				);
				this.writeOptionalFrontmatterField(
					frontmatter,
					this.plugin.fieldMapper.toUserField("googleCalendarMovedOriginalDates"),
					updatePlan.updatedTask.googleCalendarMovedOriginalDates
				);
			});

			// Step 3: Run post-write side effects (cache, events, webhooks, calendar, auto-archive)
			await this.applyPropertyChangeSideEffects(
				file,
				freshTask,
				updatePlan.updatedTask,
				property,
				freshTask[property],
				updatePlan.normalizedValue
			);

			await this.reconcileMaterializedOccurrenceStatusChange(
				freshTask,
				updatePlan.updatedTask,
				property,
				freshTask[property],
				updatePlan.normalizedValue
			);

			// Step 4: Return authoritative data
			return updatePlan.updatedTask;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			tasknotesLogger.error("Error updating task property:", {
				category: "persistence",
				operation: "updating-task-property",
				details: {
					stack: error instanceof Error ? error.stack : undefined,
					taskPath: task.path,
					property,
					value,
				},
				error: errorMessage,
			});

			throw new Error(`Failed to update task property: ${errorMessage}`);
		}
	}

	/**
	 * Run all post-write side effects for a property change WITHOUT performing a
	 * frontmatter write. This includes: cache update, EVENT_TASK_UPDATED,
	 * dependent-task UI refresh, webhooks, Google Calendar sync, and auto-archive.
	 *
	 * Callers are responsible for having already persisted the change to frontmatter.
	 */
	async applyPropertyChangeSideEffects(
		file: TFile,
		originalTask: TaskInfo,
		updatedTask: TaskInfo,
		property: keyof TaskInfo,
		oldValue: unknown,
		newValue: unknown
	): Promise<void> {
		await runTaskPropertyChangeSideEffects(
			{
				cacheManager: this.plugin.cacheManager,
				emitter: this.plugin.emitter,
				statusManager: this.plugin.statusManager,
				taskCalendarSyncService: this.plugin.taskCalendarSyncService,
				webhookNotifier: this.webhookNotifier,
				autoArchiveService: this.autoArchiveService,
				normalizeStatusValue: (value) => this.normalizeStatusValue(value),
			},
			{
				file,
				originalTask,
				updatedTask,
				property,
				oldValue,
				newValue,
			}
		);
	}

	async materializeOccurrence(
		parentTask: TaskInfo,
		targetDate: string | Date,
		overrides: Partial<TaskInfo> = {}
	): Promise<TaskInfo> {
		const freshParent =
			(await this.plugin.cacheManager.getTaskInfo(parentTask.path)) || parentTask;
		if (!freshParent.recurrence) {
			throw new Error("Task is not recurring");
		}

		const existingOccurrences = await this.plugin.cacheManager.getAllTasks();
		const plan = buildMaterializeOccurrencePlan({
			parentTask: freshParent,
			targetDate,
			currentTimestamp: getCurrentTimestamp(),
			existingOccurrences,
			parentLink: this.buildOccurrenceParentReference(freshParent),
			defaultStatus: this.plugin.settings.defaultTaskStatus,
			defaultPriority: this.plugin.settings.defaultTaskPriority,
			overrides,
		});

		if (!plan.created && plan.existingOccurrence) {
			return plan.existingOccurrence;
		}

		const taskData: TaskCreationData = {
			...(plan.occurrenceTask as Partial<TaskInfo>),
			creationContext: "api",
		};
		const { taskInfo } = await this.createTask(taskData, { applyDefaults: false });
		return taskInfo;
	}

	async findMaterializedOccurrence(
		parentTask: TaskInfo,
		targetDate: string | Date
	): Promise<TaskInfo | undefined> {
		const freshParent =
			(await this.plugin.cacheManager.getTaskInfo(parentTask.path)) || parentTask;
		if (!freshParent.recurrence) {
			return undefined;
		}

		const dateStr =
			typeof targetDate === "string"
				? targetDate.slice(0, 10)
				: formatDateForStorage(targetDate);
		const existingOccurrences = await this.plugin.cacheManager.getAllTasks();
		return findMaterializedOccurrence(
			existingOccurrences,
			freshParent,
			dateStr,
			this.buildOccurrenceParentReference(freshParent)
		);
	}

	async getMaterializedOccurrenceParent(occurrenceTask: TaskInfo): Promise<TaskInfo | null> {
		const freshOccurrence =
			(await this.plugin.cacheManager.getTaskInfo(occurrenceTask.path)) || occurrenceTask;
		return this.resolveOccurrenceParentTask(freshOccurrence);
	}

	async skipMaterializedOccurrence(
		occurrenceTask: TaskInfo,
		skippedStatus = this.getDefaultSkippedOccurrenceStatus()
	): Promise<TaskInfo> {
		const freshOccurrence =
			(await this.plugin.cacheManager.getTaskInfo(occurrenceTask.path)) || occurrenceTask;
		const parentTask = await this.resolveOccurrenceParentTask(freshOccurrence);
		if (!parentTask) {
			throw new Error("Cannot resolve occurrence parent");
		}

		const plan = buildMaterializedOccurrenceSkipPlan({
			occurrenceTask: freshOccurrence,
			parentTask,
			skippedStatus,
			currentTimestamp: getCurrentTimestamp(),
			maintainDueDateOffsetInRecurring: this.plugin.settings.maintainDueDateOffsetInRecurring,
		});

		const updatedOccurrence = await this.persistTaskInfoUpdates(
			freshOccurrence,
			plan.occurrenceUpdates,
			"skip-materialized-occurrence"
		);
		const updatedParent = await this.persistTaskInfoUpdates(
			parentTask,
			plan.parentUpdates,
			"reconcile-skipped-materialized-occurrence-parent"
		);

		if (plan.materializeNextDate) {
			try {
				await this.materializeOccurrence(updatedParent, plan.materializeNextDate);
			} catch (materializeError) {
				tasknotesLogger.warn("Failed to materialize next occurrence after skip:", {
					category: "persistence",
					operation: "materialize-next-occurrence-after-skip",
					details: {
						parentPath: updatedParent.path,
						nextDate: plan.materializeNextDate,
					},
					error: materializeError,
				});
			}
		}

		return updatedOccurrence;
	}

	async unskipMaterializedOccurrence(occurrenceTask: TaskInfo): Promise<TaskInfo> {
		const freshOccurrence =
			(await this.plugin.cacheManager.getTaskInfo(occurrenceTask.path)) || occurrenceTask;
		const parentTask = await this.resolveOccurrenceParentTask(freshOccurrence);
		if (!parentTask) {
			throw new Error("Cannot resolve occurrence parent");
		}

		const plan = buildMaterializedOccurrenceUnskipPlan({
			occurrenceTask: freshOccurrence,
			parentTask,
			activeStatus: this.plugin.settings.defaultTaskStatus,
			currentTimestamp: getCurrentTimestamp(),
		});

		const updatedOccurrence = await this.persistTaskInfoUpdates(
			freshOccurrence,
			plan.occurrenceUpdates,
			"unskip-materialized-occurrence"
		);
		await this.persistTaskInfoUpdates(
			parentTask,
			plan.parentUpdates,
			"reconcile-unskipped-materialized-occurrence-parent"
		);
		return updatedOccurrence;
	}

	private getDefaultSkippedOccurrenceStatus(): string | undefined {
		return this.plugin.settings.customStatuses.find((status) => status.isSkipped)?.value;
	}

	private async reconcileMaterializedOccurrenceStatusChange(
		originalOccurrence: TaskInfo,
		updatedOccurrence: TaskInfo,
		property: keyof TaskInfo,
		oldValue: unknown,
		newValue: unknown
	): Promise<void> {
		if (property !== "status" || !isMaterializedOccurrenceTask(updatedOccurrence)) {
			return;
		}

		const wasCompleted = this.plugin.statusManager.isCompletedStatus(
			this.normalizeStatusValue(oldValue)
		);
		const isCompleted = this.plugin.statusManager.isCompletedStatus(
			this.normalizeStatusValue(newValue)
		);
		if (wasCompleted === isCompleted) {
			return;
		}

		const parentTask = await this.resolveOccurrenceParentTask(updatedOccurrence);
		if (!parentTask) {
			tasknotesLogger.warn("Could not resolve materialized occurrence parent:", {
				category: "persistence",
				operation: "resolve-materialized-occurrence-parent",
				details: {
					taskPath: updatedOccurrence.path,
					parent: updatedOccurrence.recurrence_parent,
				},
			});
			return;
		}

		const currentTimestamp = getCurrentTimestamp();
		const plan = isCompleted
			? buildMaterializedOccurrenceCompletePlan({
					occurrenceTask: updatedOccurrence,
					parentTask,
					completedStatus: this.normalizeStatusValue(newValue),
					currentTimestamp,
					maintainDueDateOffsetInRecurring:
						this.plugin.settings.maintainDueDateOffsetInRecurring,
				})
			: buildMaterializedOccurrenceUncompletePlan({
					occurrenceTask: originalOccurrence,
					parentTask,
					activeStatus: this.normalizeStatusValue(newValue),
					currentTimestamp,
				});

		const updatedParent = await this.persistTaskInfoUpdates(
			parentTask,
			plan.parentUpdates,
			"reconcile-materialized-occurrence-parent"
		);

		if (isCompleted && this.webhookNotifier) {
			try {
				await this.webhookNotifier.triggerWebhook("recurring.instance.completed", {
					task: updatedParent,
					occurrence: updatedOccurrence,
					date: plan.targetDate,
				});
			} catch (webhookError) {
				tasknotesLogger.warn("Failed to trigger materialized occurrence webhook:", {
					category: "provider",
					operation: "trigger-materialized-occurrence-webhook",
					error: webhookError,
				});
			}
		}

		if (isCompleted && plan.materializeNextDate) {
			try {
				await this.materializeOccurrence(updatedParent, plan.materializeNextDate);
			} catch (materializeError) {
				tasknotesLogger.warn("Failed to materialize next occurrence after completion:", {
					category: "persistence",
					operation: "materialize-next-occurrence-after-completion",
					details: {
						parentPath: updatedParent.path,
						nextDate: plan.materializeNextDate,
					},
					error: materializeError,
				});
			}
		}
	}

	private async resolveOccurrenceParentTask(occurrenceTask: TaskInfo): Promise<TaskInfo | null> {
		if (!occurrenceTask.recurrence_parent) {
			return null;
		}

		const linkPath = parseLinkToPath(occurrenceTask.recurrence_parent);
		const candidates = new Set<string>([linkPath]);
		if (linkPath && !linkPath.endsWith(".md")) {
			candidates.add(`${linkPath}.md`);
		}

		for (const candidate of candidates) {
			const task = await this.plugin.cacheManager.getTaskInfo(candidate);
			if (task) {
				return task;
			}
		}

		const resolved = this.plugin.app.metadataCache.getFirstLinkpathDest?.(
			linkPath,
			occurrenceTask.path
		);
		if (resolved instanceof TFile) {
			return await this.plugin.cacheManager.getTaskInfo(resolved.path);
		}

		return null;
	}

	private buildOccurrenceParentReference(parentTask: TaskInfo): string {
		const parentFile = this.plugin.app.vault.getAbstractFileByPath(parentTask.path);
		if (parentFile instanceof TFile) {
			return generateLink(
				this.plugin.app,
				parentFile,
				"",
				undefined,
				undefined,
				this.plugin.settings.useFrontmatterMarkdownLinks
			);
		}

		return `[[${parentTask.path.replace(/\.md$/i, "")}]]`;
	}

	private applyModelTaskUpdatesToFrontmatter(
		frontmatter: Record<string, unknown>,
		updates: Partial<TaskInfo>
	): void {
		const patch = taskInfoUpdatesToFrontmatterPatch(
			updates,
			this.plugin.fieldMapper.getMapping()
		);
		for (const operation of patch) {
			if (operation.op === "delete") {
				delete frontmatter[operation.field];
			} else {
				frontmatter[operation.field] = operation.value;
			}
		}
	}

	private async persistTaskInfoUpdates(
		task: TaskInfo,
		updates: Partial<TaskInfo>,
		operation: string
	): Promise<TaskInfo> {
		if (Object.keys(updates).length === 0) {
			return task;
		}

		const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
		if (!(file instanceof TFile)) {
			throw new Error(`Cannot find task file: ${task.path}`);
		}

		const updatedTask: TaskInfo = { ...task, ...updates };
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			this.applyModelTaskUpdatesToFrontmatter(frontmatter, updates);
		});

		try {
			if (this.plugin.cacheManager.waitForFreshTaskData) {
				await this.plugin.cacheManager.waitForFreshTaskData(file);
			}
			this.plugin.cacheManager.updateTaskInfoInCache(task.path, updatedTask);
		} catch (cacheError) {
			tasknotesLogger.error("Error updating cache for model task updates:", {
				category: "stale-data",
				operation: "persist-model-task-updates-cache",
				details: { taskPath: task.path, sourceOperation: operation },
				error: cacheError,
			});
		}

		this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
			path: task.path,
			originalTask: task,
			updatedTask,
		});

		if (this.plugin.taskCalendarSyncService?.isEnabled()) {
			this.plugin.taskCalendarSyncService
				.updateTaskInCalendar(updatedTask, task)
				.catch((error) => {
					tasknotesLogger.warn("Failed to sync model task update to Google Calendar:", {
						category: "provider",
						operation: "sync-model-task-update-google-calendar",
						details: { taskPath: task.path, sourceOperation: operation },
						error,
					});
				});
		}

		return updatedTask;
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
		const archivePlan = buildTaskArchiveState(task, archiveTag, getCurrentTimestamp());
		const { updatedTask, isCurrentlyArchived, dateModified } = archivePlan;

		// Step 2: Persist to file
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");
			applyTaskArchiveFrontmatterChange({
				frontmatter,
				archiveTag,
				isCurrentlyArchived,
				dateModified,
				dateModifiedField,
			});
		});

		// Step 2.5: Move file based on archive operation and settings
		let movedFile = file;
		const movePlan = buildTaskArchiveMovePlan({
			isCurrentlyArchived,
			moveArchivedTasks: this.plugin.settings.moveArchivedTasks,
			archiveFolderTemplate: this.plugin.settings.archiveFolder,
			tasksFolderTemplate: this.plugin.settings.tasksFolder,
			fileName: file.name,
			taskData: {
				title: updatedTask.title || "",
				priority: updatedTask.priority,
				status: updatedTask.status,
				contexts: updatedTask.contexts,
				projects: updatedTask.projects,
			},
			processFolderTemplate: (folderTemplate, taskData) =>
				this.processFolderTemplate(folderTemplate, taskData),
		});
		if (movePlan) {
			try {
				await ensureFolderExists(this.plugin.app.vault, movePlan.destinationFolder);

				const existingFile = this.plugin.app.vault.getAbstractFileByPath(movePlan.newPath);
				if (existingFile) {
					throw new Error(
						`A file named "${file.name}" already exists in the ${movePlan.destinationKind} folder "${movePlan.destinationFolder}". Cannot move task to avoid overwriting existing file.`
					);
				}

				await this.plugin.app.fileManager.renameFile(file, movePlan.newPath);

				const resolvedMovedFile = this.plugin.app.vault.getAbstractFileByPath(
					movePlan.newPath
				);
				if (!(resolvedMovedFile instanceof TFile)) {
					throw new Error(`Failed to resolve moved task file: ${movePlan.newPath}`);
				}
				movedFile = resolvedMovedFile;
				updatedTask.path = movePlan.newPath;

				this.plugin.cacheManager.clearCacheEntry(task.path);
			} catch (moveError) {
				// If moving fails, show error but don't break the archive operation
				const errorMessage =
					moveError instanceof Error ? moveError.message : String(moveError);
				const operation = movePlan.operation;
				tasknotesLogger.error(`Error moving ${operation} task:`, {
					category: "persistence",
					operation: "moving",
					details: { value: errorMessage },
				});
				publishUserNotice(
					this.plugin.emitter,
					this.translate("services.task.notices.moveTaskFailed", {
						operation,
						error: errorMessage,
					})
				);
				// Continue with archive operation without moving the file
			}
		}

		let archiveCalendarCleanupComplete = true;
		if (this.plugin.taskCalendarSyncService?.isEnabled() && updatedTask.archived) {
			if (this.hasGoogleCalendarLinks(task)) {
				const archiveCalendarTask = this.createArchiveCalendarDeletionTask(
					task,
					updatedTask
				);
				archiveCalendarCleanupComplete =
					await this.deleteArchivedTaskFromCalendar(archiveCalendarTask);
				if (archiveCalendarCleanupComplete) {
					this.clearGoogleCalendarMetadata(updatedTask);
				}
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
			tasknotesLogger.error("Error updating cache for archived task:", {
				category: "stale-data",
				operation: "updating-cache-archived-task",
				error: cacheError,
			});
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
				tasknotesLogger.warn("Failed to trigger webhook for task archive/unarchive:", {
					category: "provider",
					operation: "trigger-webhook-task-archive-unarchive",
					error: error,
				});
			}
		}

		// Sync to Google Calendar if enabled
		// Archiving removes from calendar (archived tasks aren't synced)
		// Unarchiving may re-add to calendar
		if (this.plugin.taskCalendarSyncService?.isEnabled()) {
			if (!updatedTask.archived) {
				// Task is being unarchived - sync it back if eligible
				this.plugin.taskCalendarSyncService
					.updateTaskInCalendar(updatedTask, task)
					.catch((error) => {
						tasknotesLogger.warn("Failed to sync unarchived task to Google Calendar:", {
							category: "provider",
							operation: "sync-unarchived-task-google-calendar",
							error: error,
						});
					});
			} else if (
				!archiveCalendarCleanupComplete &&
				this.hasGoogleCalendarLinks(updatedTask)
			) {
				tasknotesLogger.warn(
					"Archived task still has Google Calendar links and will need retry cleanup:",
					{
						category: "provider",
						operation:
							"archived-task-still-has-google-calendar-links-and-will-need-retry-cleanup",
						details: { value: updatedTask.path },
					}
				);
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
		const timeTrackingPlan = buildStartTimeTrackingPlan(
			task,
			getCurrentTimestamp(),
			new Date().toISOString()
		);
		const { updatedTask, newEntry } = timeTrackingPlan;

		// Step 2: Persist to file
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const timeEntriesField = this.plugin.fieldMapper.toUserField("timeEntries");
			const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");
			applyStartTimeTrackingFrontmatterChange({
				frontmatter,
				timeEntriesField,
				dateModifiedField,
				newEntry,
				dateModified: timeTrackingPlan.dateModified,
			});
		});

		// Step 3: Wait for fresh data and update cache
		try {
			// Wait for the metadata cache to have the updated time entries
			if (this.plugin.cacheManager.waitForFreshTaskData) {
				await this.plugin.cacheManager.waitForFreshTaskData(file);
			}
			this.plugin.cacheManager.updateTaskInfoInCache(task.path, updatedTask);
		} catch (cacheError) {
			tasknotesLogger.error("Error updating cache for time tracking start:", {
				category: "stale-data",
				operation: "updating-cache-time-tracking-start",
				error: cacheError,
			});
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
				tasknotesLogger.warn("Failed to trigger webhook for time tracking start:", {
					category: "provider",
					operation: "trigger-webhook-time-tracking-start",
					error: error,
				});
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

		// Step 1: Construct new state in memory
		const timeTrackingPlan = buildStopTimeTrackingPlan(
			task,
			activeSession,
			getCurrentTimestamp(),
			new Date().toISOString()
		);
		const { updatedTask } = timeTrackingPlan;

		// Step 2: Persist to file
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const timeEntriesField = this.plugin.fieldMapper.toUserField("timeEntries");
			const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");
			applyStopTimeTrackingFrontmatterChange({
				frontmatter,
				timeEntriesField,
				dateModifiedField,
				activeSession,
				stopTimestamp: timeTrackingPlan.stopTimestamp,
				dateModified: timeTrackingPlan.dateModified,
			});
		});

		// Step 3: Wait for fresh data and update cache
		try {
			// Wait for the metadata cache to have the updated time entries
			if (this.plugin.cacheManager.waitForFreshTaskData) {
				await this.plugin.cacheManager.waitForFreshTaskData(file);
			}
			this.plugin.cacheManager.updateTaskInfoInCache(task.path, updatedTask);
		} catch (cacheError) {
			tasknotesLogger.error("Error updating cache for time tracking stop:", {
				category: "stale-data",
				operation: "updating-cache-time-tracking-stop",
				error: cacheError,
			});
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
				tasknotesLogger.warn("Failed to trigger webhook for time tracking stop:", {
					category: "provider",
					operation: "trigger-webhook-time-tracking-stop",
					error: error,
				});
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
		return this.taskUpdateService.updateTask(originalTask, updates);
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

		const { uniqueAdditions, uniqueRemovals } = buildBlockingRelationshipPathChanges(
			addedBlockedTaskPaths,
			removedBlockedTaskPaths
		);

		// Remove current task from the blockedBy field of tasks it's no longer blocking
		for (const blockedTaskPath of uniqueRemovals) {
			const blockedTask = await this.plugin.cacheManager.getTaskInfo(blockedTaskPath);
			if (!blockedTask) {
				continue;
			}

			const updates = buildBlockedByTaskUpdate(
				this.computeBlockedByUpdate(blockedTask, currentTask.path, "remove")
			);
			if (!updates) {
				continue;
			}

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
			const updates = buildBlockedByTaskUpdate(
				this.computeBlockedByUpdate(
					blockedTask,
					currentTask.path,
					"add",
					rawEntries[blockedTaskPath]
				)
			);
			if (!updates) {
				continue;
			}

			await this.updateTask(blockedTask, updates);
		}
	}

	private computeBlockedByUpdate(
		blockedTask: TaskInfo,
		blockingTaskPath: string,
		action: "add" | "remove",
		rawEntry?: TaskDependency | string
	): TaskDependency[] | null {
		return computeBlockedByUpdate({
			blockedTask,
			blockingTaskPath,
			action,
			rawEntry,
			useFrontmatterMarkdownLinks: this.plugin.settings.useFrontmatterMarkdownLinks,
			resolveDependencyPath: (sourcePath, entry) =>
				resolveDependencyEntry(this.plugin.app, sourcePath, entry)?.path ?? null,
			formatDependencyLink: (sourcePath, targetPath, useMarkdownLinks) =>
				formatDependencyLink(this.plugin.app, sourcePath, targetPath, useMarkdownLinks),
		});
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
			if (this.plugin.taskCalendarSyncService && this.hasGoogleCalendarLinks(task)) {
				try {
					await this.plugin.taskCalendarSyncService.deleteTaskFromCalendarByPath(
						task.path,
						task.googleCalendarEventId,
						task.googleCalendarExceptionEventId
					);
				} catch (error) {
					tasknotesLogger.warn("Failed to delete task from Google Calendar:", {
						category: "provider",
						operation: "delete-task-google-calendar",
						error: error,
					});
				}
			}

			// Step 1: Delete the file from the vault
			await this.plugin.app.fileManager.trashFile(file);

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
					tasknotesLogger.warn("Failed to trigger webhook for task deletion:", {
						category: "provider",
						operation: "trigger-webhook-task-deletion",
						error: error,
					});
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			tasknotesLogger.error("Error deleting task:", {
				category: "persistence",
				operation: "deleting-task",
				details: {
					stack: error instanceof Error ? error.stack : undefined,
					taskPath: task.path,
				},
				error: errorMessage,
			});

			throw new Error(`Failed to delete task: ${errorMessage}`);
		}
	}

	/**
	 * Toggle completion status for recurring tasks on a specific date
	 */
	async resolveRecurringTaskActionDate(task: TaskInfo, date?: Date): Promise<Date> {
		if (date) {
			return date;
		}

		const freshTask = (await this.plugin.cacheManager.getTaskInfo(task.path)) || task;
		return this.getRecurringTaskActionDate(freshTask);
	}

	private getRecurringTaskActionDate(task: TaskInfo, date?: Date): Date {
		return getRecurringTaskActionDate(task, date);
	}

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

		const recurringPlan = buildRecurringTaskCompletePlan({
			freshTask,
			targetDate: this.getRecurringTaskActionDate(freshTask, date),
			currentTimestamp: getCurrentTimestamp(),
			maintainDueDateOffsetInRecurring: this.plugin.settings.maintainDueDateOffsetInRecurring,
		});
		const { updatedTask, dateStr, newComplete, targetDate } = recurringPlan;

		// Step 2: Persist to file
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const completeInstancesField = this.plugin.fieldMapper.toUserField("completeInstances");
			const skippedInstancesField = this.plugin.fieldMapper.toUserField("skippedInstances");
			const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");
			const scheduledField = this.plugin.fieldMapper.toUserField("scheduled");
			const dueField = this.plugin.fieldMapper.toUserField("due");
			const recurrenceField = this.plugin.fieldMapper.toUserField("recurrence");
			const googleCalendarExceptionOriginalScheduledField =
				this.plugin.fieldMapper.toUserField("googleCalendarExceptionOriginalScheduled");
			const googleCalendarMovedOriginalDatesField = this.plugin.fieldMapper.toUserField(
				"googleCalendarMovedOriginalDates"
			);

			applyRecurringTaskCompleteFrontmatterChange({
				frontmatter,
				completeInstancesField,
				skippedInstancesField,
				dateModifiedField,
				scheduledField,
				dueField,
				recurrenceField,
				googleCalendarExceptionOriginalScheduledField,
				googleCalendarMovedOriginalDatesField,
				plan: recurringPlan,
			});
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
				const newContent =
					finalBody.length > 0 ? `${frontmatterBlock}${finalBody}\n` : frontmatterBlock;
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
			tasknotesLogger.error("Error updating cache for recurring task:", {
				category: "stale-data",
				operation: "updating-cache-recurring-task",
				error: cacheError,
			});
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
				tasknotesLogger.error("Error triggering recurring task completion webhook:", {
					category: "provider",
					operation: "triggering-recurring-task-completion-webhook",
					error: webhookError,
				});
			}
		}

		// Step 6: Sync to Google Calendar if enabled (scheduled date changed)
		if (this.plugin.taskCalendarSyncService?.isEnabled()) {
			// Recurring task completion updates the scheduled date to next occurrence
			this.plugin.taskCalendarSyncService
				.updateTaskInCalendar(updatedTask, freshTask)
				.catch((error) => {
					tasknotesLogger.warn(
						"Failed to sync recurring task update to Google Calendar:",
						{
							category: "provider",
							operation: "sync-recurring-task-update-google-calendar",
							error: error,
						}
					);
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

		const recurringPlan = buildRecurringTaskSkippedPlan({
			freshTask,
			targetDate: this.getRecurringTaskActionDate(freshTask, date),
			currentTimestamp: getCurrentTimestamp(),
			maintainDueDateOffsetInRecurring: this.plugin.settings.maintainDueDateOffsetInRecurring,
		});
		const { updatedTask, dateStr, newSkipped, targetDate } = recurringPlan;

		// Step 3: Persist to file
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const skippedField = this.plugin.fieldMapper.toUserField("skippedInstances");
			const completeField = this.plugin.fieldMapper.toUserField("completeInstances");
			const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");
			const scheduledField = this.plugin.fieldMapper.toUserField("scheduled");
			const dueField = this.plugin.fieldMapper.toUserField("due");
			const googleCalendarExceptionOriginalScheduledField =
				this.plugin.fieldMapper.toUserField("googleCalendarExceptionOriginalScheduled");
			const googleCalendarMovedOriginalDatesField = this.plugin.fieldMapper.toUserField(
				"googleCalendarMovedOriginalDates"
			);

			applyRecurringTaskSkippedFrontmatterChange({
				frontmatter,
				skippedField,
				completeField,
				dateModifiedField,
				scheduledField,
				dueField,
				googleCalendarExceptionOriginalScheduledField,
				googleCalendarMovedOriginalDatesField,
				plan: recurringPlan,
			});
		});

		// Step 4: Wait for fresh data and update cache
		try {
			if (this.plugin.cacheManager.waitForFreshTaskData) {
				await this.plugin.cacheManager.waitForFreshTaskData(file);
			}
			this.plugin.cacheManager.updateTaskInfoInCache(freshTask.path, updatedTask);
		} catch (cacheError) {
			tasknotesLogger.error("Error updating cache for skipped recurring task:", {
				category: "stale-data",
				operation: "updating-cache-skipped-recurring-task",
				error: cacheError,
			});
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
				tasknotesLogger.error("Error triggering recurring task skip webhook:", {
					category: "provider",
					operation: "triggering-recurring-task-skip-webhook",
					error: webhookError,
				});
			}
		}

		// Step 7: Sync to Google Calendar if enabled (scheduled date changed)
		if (this.plugin.taskCalendarSyncService?.isEnabled()) {
			// Skipping a recurring task updates the scheduled date to next occurrence
			this.plugin.taskCalendarSyncService
				.updateTaskInCalendar(updatedTask, freshTask)
				.catch((error) => {
					tasknotesLogger.warn("Failed to sync recurring task skip to Google Calendar:", {
						category: "provider",
						operation: "sync-recurring-task-skip-google-calendar",
						error: error,
					});
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

		// Step 1: Construct new state in memory
		const deletePlan = buildDeleteTimeEntryPlan(task, timeEntryIndex, getCurrentTimestamp());
		const { updatedTask } = deletePlan;

		// Step 2: Persist to file
		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const timeEntriesField = this.plugin.fieldMapper.toUserField("timeEntries");
			const dateModifiedField = this.plugin.fieldMapper.toUserField("dateModified");
			applyDeleteTimeEntryFrontmatterChange({
				frontmatter,
				timeEntriesField,
				dateModifiedField,
				timeEntryIndex: deletePlan.timeEntryIndex,
				dateModified: deletePlan.dateModified,
			});
		});

		// Step 3: Wait for fresh data and update cache
		try {
			// Wait for the metadata cache to have the updated time entries
			if (this.plugin.cacheManager.waitForFreshTaskData) {
				await this.plugin.cacheManager.waitForFreshTaskData(file);
			}
			this.plugin.cacheManager.updateTaskInfoInCache(task.path, updatedTask);
		} catch (cacheError) {
			tasknotesLogger.error("Error updating cache for time entry deletion:", {
				category: "stale-data",
				operation: "updating-cache-time-entry-deletion",
				error: cacheError,
			});
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
	updateCompletedDateInFrontmatter(
		frontmatter: Record<string, unknown>,
		newStatus: string,
		isRecurring: boolean
	): void {
		if (isRecurring) {
			return; // Recurring tasks don't use completedDate
		}

		const completedDateField = this.plugin.fieldMapper.toUserField("completedDate");
		updateCompletedDateFrontmatter(
			frontmatter,
			newStatus,
			isRecurring,
			completedDateField,
			(status) => this.plugin.statusManager.isCompletedStatus(status),
			getCurrentDateString()
		);
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

	private extractProjectFilePath(project: string): string {
		const linkPath = parseLinkToPath(project);
		const resolved = this.plugin.app.metadataCache.getFirstLinkpathDest?.(linkPath, "");
		return (resolved?.path ?? linkPath).replace(/\.md$/i, "");
	}
}
