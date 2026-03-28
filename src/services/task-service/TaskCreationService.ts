import { Notice, TFile, normalizePath, stringifyYaml } from "obsidian";
import {
	EVENT_TASK_UPDATED,
	IWebhookNotifier,
	TaskCreationData,
	TaskInfo,
} from "../../types";
import { FilenameContext, generateTaskFilename, generateUniqueFilename } from "../../utils/filenameGenerator";
import { addDTSTARTToRecurrenceRule, ensureFolderExists } from "../../utils/helpers";
import { getCurrentTimestamp } from "../../utils/dateUtils";
import { mergeTemplateFrontmatter } from "../../utils/templateProcessor";
import type TaskNotesPlugin from "../../main";

interface TemplateApplicationResult {
	frontmatter: Record<string, unknown>;
	body: string;
}

export interface TaskCreationServiceDependencies {
	plugin: TaskNotesPlugin;
	webhookNotifier?: IWebhookNotifier;
	applyTaskCreationDefaults(taskData: TaskCreationData): Promise<TaskCreationData>;
	applyTemplate(taskData: TaskCreationData): Promise<TemplateApplicationResult>;
	processFolderTemplate(folderTemplate: string, taskData?: TaskCreationData, date?: Date): string;
	sanitizeTitleForFilename(input: string): string;
	sanitizeTitleForStorage(input: string): string;
}

export class TaskCreationService {
	constructor(private deps: TaskCreationServiceDependencies) {}

	setWebhookNotifier(webhookNotifier?: IWebhookNotifier): void {
		this.deps.webhookNotifier = webhookNotifier;
	}

	async createTask(
		taskData: TaskCreationData,
		options: { applyDefaults?: boolean } = {}
	): Promise<{ file: TFile; taskInfo: TaskInfo }> {
		const { applyDefaults = true } = options;
		const { plugin } = this.deps;

		try {
			if (applyDefaults) {
				taskData = await this.deps.applyTaskCreationDefaults(taskData);
			}

			if (!taskData.title || !taskData.title.trim()) {
				throw new Error("Title is required");
			}

			const title = plugin.settings.storeTitleInFilename
				? this.deps.sanitizeTitleForFilename(taskData.title.trim())
				: this.deps.sanitizeTitleForStorage(taskData.title.trim());
			const priority = taskData.priority || plugin.settings.defaultTaskPriority;
			const status = taskData.status || plugin.settings.defaultTaskStatus;
			const dateCreated = taskData.dateCreated || getCurrentTimestamp();
			const dateModified = taskData.dateModified || getCurrentTimestamp();

			const contextsArray = taskData.contexts || [];
			const projectsArray = taskData.projects || [];
			let tagsArray = taskData.tags || [];

			if (plugin.settings.taskIdentificationMethod === "tag") {
				if (!tagsArray.includes(plugin.settings.taskTag)) {
					tagsArray = [plugin.settings.taskTag, ...tagsArray];
				}
			}

			const filenameContext: FilenameContext = {
				title,
				priority,
				status,
				date: new Date(),
				dueDate: taskData.due,
				scheduledDate: taskData.scheduled,
			};

			const baseFilename = generateTaskFilename(filenameContext, plugin.settings);
			const folder = await this.resolveTargetFolder(taskData);

			if (folder) {
				await ensureFolderExists(plugin.app.vault, folder);
			}

			const uniqueFilename = await generateUniqueFilename(baseFilename, folder, plugin.app.vault);
			const fullPath = folder ? `${folder}/${uniqueFilename}.md` : `${uniqueFilename}.md`;

			const completeTaskData: Partial<TaskInfo> = {
				title,
				status,
				priority,
				due: taskData.due || undefined,
				scheduled: taskData.scheduled || undefined,
				contexts: contextsArray.length > 0 ? contextsArray : undefined,
				projects: projectsArray.length > 0 ? projectsArray : undefined,
				timeEstimate:
					taskData.timeEstimate && taskData.timeEstimate > 0 ? taskData.timeEstimate : undefined,
				dateCreated,
				dateModified,
				recurrence: taskData.recurrence || undefined,
				recurrence_anchor: taskData.recurrence_anchor || undefined,
				reminders:
					taskData.reminders && taskData.reminders.length > 0 ? taskData.reminders : undefined,
				icsEventId: taskData.icsEventId || undefined,
			};

			if (
				completeTaskData.recurrence &&
				typeof completeTaskData.recurrence === "string" &&
				!completeTaskData.recurrence.includes("DTSTART:")
			) {
				const tempTaskInfo: TaskInfo = {
					...completeTaskData,
					title,
					status,
					priority,
					path: "",
					archived: false,
				};
				const recurrenceWithDtstart = addDTSTARTToRecurrenceRule(tempTaskInfo);
				if (recurrenceWithDtstart) {
					completeTaskData.recurrence = recurrenceWithDtstart;
				}
			}

			const shouldAddTaskTag = plugin.settings.taskIdentificationMethod === "tag";
			const taskTagForFrontmatter = shouldAddTaskTag ? plugin.settings.taskTag : undefined;

			const frontmatter = plugin.fieldMapper.mapToFrontmatter(
				completeTaskData,
				taskTagForFrontmatter,
				plugin.settings.storeTitleInFilename
			);

			if (plugin.settings.taskIdentificationMethod === "property") {
				const propName = plugin.settings.taskPropertyName;
				const propValue = plugin.settings.taskPropertyValue;
				if (propName && propValue) {
					const lower = propValue.toLowerCase();
					const coercedValue =
						lower === "true" || lower === "false" ? lower === "true" : propValue;
					frontmatter[propName] = coercedValue;
				}
				if (tagsArray.length > 0) {
					frontmatter.tags = tagsArray;
				}
			} else {
				frontmatter.tags = tagsArray;
			}

			const templateResult = await this.deps.applyTemplate(taskData);
			const normalizedBody = templateResult.body
				? templateResult.body.replace(/\r\n/g, "\n").trimEnd()
				: taskData.details
					? taskData.details.replace(/\r\n/g, "\n").trimEnd()
					: "";

			let finalFrontmatter = mergeTemplateFrontmatter(frontmatter, templateResult.frontmatter);
			if (taskData.customFrontmatter) {
				finalFrontmatter = { ...finalFrontmatter, ...taskData.customFrontmatter };
			}

			const yamlHeader = stringifyYaml(finalFrontmatter);
			let content = `---\n${yamlHeader}---\n\n`;
			if (normalizedBody.length > 0) {
				content += `${normalizedBody}\n`;
			}

			const file = await plugin.app.vault.create(fullPath, content);

			const taskInfo: TaskInfo = {
				...completeTaskData,
				...finalFrontmatter,
				title: String(finalFrontmatter.title || completeTaskData.title || title),
				status: String(finalFrontmatter.status || completeTaskData.status || status),
				priority: String(finalFrontmatter.priority || completeTaskData.priority || priority),
				path: file.path,
				tags: tagsArray,
				archived: false,
				details: normalizedBody,
			};

			try {
				if (plugin.cacheManager.waitForFreshTaskData) {
					await plugin.cacheManager.waitForFreshTaskData(file);
				}
				plugin.cacheManager.updateTaskInfoInCache(file.path, taskInfo);
			} catch (cacheError) {
				console.error("Error updating cache for new task:", cacheError);
			}

			plugin.emitter.trigger(EVENT_TASK_UPDATED, {
				path: file.path,
				updatedTask: taskInfo,
			});

			if (this.deps.webhookNotifier) {
				try {
					await this.deps.webhookNotifier.triggerWebhook("task.created", { task: taskInfo });
				} catch (error) {
					console.warn("Failed to trigger webhook for task creation:", error);
				}
			}

			if (
				plugin.taskCalendarSyncService?.isEnabled() &&
				plugin.settings.googleCalendarExport.syncOnTaskCreate
			) {
				plugin.taskCalendarSyncService.syncTaskToCalendar(taskInfo).catch((error) => {
					console.warn("Failed to sync task to Google Calendar:", error);
				});
			}

			return { file, taskInfo };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("Error creating task:", {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
				taskData,
			});
			throw new Error(`Failed to create task: ${errorMessage}`);
		}
	}

	private async resolveTargetFolder(taskData: TaskCreationData): Promise<string> {
		const { plugin } = this.deps;
		let folder = "";

		if (
			taskData.creationContext === "inline-conversion" ||
			taskData.creationContext === "modal-inline-creation"
		) {
			const inlineFolder = plugin.settings.inlineTaskConvertFolder || "";
			if (inlineFolder.trim()) {
				folder = inlineFolder;
				if (
					inlineFolder.includes("{{currentNotePath}}") ||
					inlineFolder.includes("{{currentNoteTitle}}")
				) {
					const currentFile = plugin.app.workspace.getActiveFile();
					if (inlineFolder.includes("{{currentNotePath}}")) {
						const currentFolderPath = currentFile?.parent?.path || "";
						folder = folder.replace(/\{\{currentNotePath\}\}/g, currentFolderPath);
					}
					if (inlineFolder.includes("{{currentNoteTitle}}")) {
						const currentNoteTitle = currentFile?.basename || "";
						folder = folder.replace(/\{\{currentNoteTitle\}\}/g, currentNoteTitle);
					}
				}
				return this.deps.processFolderTemplate(folder, taskData);
			}

			const tasksFolder = plugin.settings.tasksFolder || "";
			return this.deps.processFolderTemplate(tasksFolder, taskData);
		}

		const tasksFolder = plugin.settings.tasksFolder || "";
		return this.deps.processFolderTemplate(tasksFolder, taskData);
	}
}
