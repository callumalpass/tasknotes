import { TFile, stringifyYaml, type Vault } from "obsidian";
import {
	EVENT_TASK_UPDATED,
	FieldMapping,
	IWebhookNotifier,
	TaskCreationData,
	TaskInfo,
} from "../../types";
import type { TaskNotesSettings } from "../../types/settings";
import { addDTSTARTToRecurrenceRule } from "../../core/recurrence";
import {
	FilenameContext,
	type TaskFilenameSettings,
	generateTaskFilename,
	generateUniqueFilename,
} from "../../utils/filenameGenerator";
import { ensureFolderExists } from "../../utils/helpers";
import { getCurrentTimestamp } from "../../utils/dateUtils";
import { stringifyUnknown } from "../../utils/stringUtils";
import { mergeTemplateFrontmatter } from "../../utils/templateProcessor";
import {
	applyPropertyTaskIdentifier,
	getFrontmatterTags,
} from "../../utils/taskIdentificationFrontmatter";
import type { UserMappedField } from "../../types/settings";
import { createTaskNotesLogger } from "../../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/TaskService/TaskCreationService" });

interface TemplateApplicationResult {
	frontmatter: Record<string, unknown>;
	body: string;
}

interface TaskCreationWorkspace {
	getActiveFile(): TFile | null;
}

interface TaskCreationVault extends Vault {
	create(path: string, content: string): Promise<TFile>;
}

interface TaskCreationFieldMapper {
	getUserFields(): UserMappedField[];
	mapToFrontmatter(
		taskData: Partial<TaskInfo>,
		taskTag?: string,
		storeTitleInFilename?: boolean
	): Record<string, unknown>;
	toUserField(field: keyof FieldMapping): string;
}

interface TaskCreationCacheManager {
	waitForFreshTaskData?: (file: TFile) => Promise<void>;
	updateTaskInfoInCache(path: string, task: TaskInfo): void;
}

interface TaskCreationEmitter {
	trigger(event: typeof EVENT_TASK_UPDATED, payload: unknown): void;
}

interface TaskCreationCalendarSyncService {
	syncTaskToCalendar(task: TaskInfo): Promise<unknown>;
}

type TaskCreationSettings = Pick<
	TaskNotesSettings,
	| "storeTitleInFilename"
	| "defaultTaskPriority"
	| "defaultTaskStatus"
	| "taskIdentificationMethod"
	| "taskTag"
	| "taskPropertyName"
	| "taskPropertyValue"
	| "inlineTaskConvertFolder"
	| "tasksFolder"
	| "googleCalendarExport"
> &
	TaskFilenameSettings;

export interface TaskCreationRuntime {
	app: {
		vault: TaskCreationVault;
		workspace: TaskCreationWorkspace;
	};
	settings: TaskCreationSettings;
	fieldMapper: TaskCreationFieldMapper;
	cacheManager: TaskCreationCacheManager;
	emitter: TaskCreationEmitter;
	taskCalendarSyncService?: TaskCreationCalendarSyncService;
}

export interface TaskCreationServiceDependencies {
	runtime: TaskCreationRuntime;
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
		const { runtime } = this.deps;

		try {
			if (applyDefaults) {
				taskData = await this.deps.applyTaskCreationDefaults(taskData);
			}

			if (!taskData.title || !taskData.title.trim()) {
				throw new Error("Title is required");
			}

			const rawTitle = taskData.title.trim();
			const title = this.deps.sanitizeTitleForStorage(rawTitle);
			const filenameTitle = runtime.settings.storeTitleInFilename
				? this.deps.sanitizeTitleForFilename(rawTitle)
				: title;
			const priority = taskData.priority || runtime.settings.defaultTaskPriority;
			const status = taskData.status || runtime.settings.defaultTaskStatus;
			const dateCreated = taskData.dateCreated || getCurrentTimestamp();
			const dateModified = taskData.dateModified || getCurrentTimestamp();

			const contextsArray = taskData.contexts || [];
			const projectsArray = taskData.projects || [];
			let tagsArray = taskData.tags || [];

			if (runtime.settings.taskIdentificationMethod === "tag") {
				if (!tagsArray.includes(runtime.settings.taskTag)) {
					tagsArray = [runtime.settings.taskTag, ...tagsArray];
				}
			}

			const filenameContext: FilenameContext = {
				title: filenameTitle,
				priority,
				status,
				date: new Date(),
				dueDate: taskData.due,
				scheduledDate: taskData.scheduled,
				contexts: contextsArray,
				projects: projectsArray,
				tags: tagsArray,
				timeEstimate: taskData.timeEstimate,
				details: taskData.details,
				parentNote: taskData.parentNote,
			};

			const baseFilename = generateTaskFilename(filenameContext, runtime.settings);
			const folder = await this.resolveTargetFolder(taskData);

			if (folder) {
				await ensureFolderExists(runtime.app.vault, folder);
			}

			const uniqueFilename = await generateUniqueFilename(
				baseFilename,
				folder,
				runtime.app.vault
			);
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
					taskData.timeEstimate && taskData.timeEstimate > 0
						? taskData.timeEstimate
						: undefined,
				dateCreated,
				dateModified,
				recurrence: taskData.recurrence || undefined,
				recurrence_anchor: taskData.recurrence_anchor || undefined,
				reminders:
					taskData.reminders && taskData.reminders.length > 0
						? taskData.reminders
						: undefined,
				icsEventId: taskData.icsEventId || undefined,
				blockedBy:
					taskData.blockedBy && taskData.blockedBy.length > 0
						? taskData.blockedBy
						: undefined,
			};

			// Thread user-defined field values from taskData through to frontmatter.
			// completeTaskData only lists hardcoded core fields, so we copy any user
			// field values here before mapToFrontmatter is called.
			const userFields = runtime.fieldMapper.getUserFields();
			if (userFields.length > 0) {
				const taskDataAny = taskData as Record<string, unknown>;
				const completeAny = completeTaskData as Record<string, unknown>;
				for (const field of userFields) {
					if (
						Object.prototype.hasOwnProperty.call(taskDataAny, field.key) &&
						taskDataAny[field.key] !== undefined
					) {
						completeAny[field.key] = taskDataAny[field.key];
					}
				}
			}

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

			const shouldAddTaskTag = runtime.settings.taskIdentificationMethod === "tag";
			const taskTagForFrontmatter = shouldAddTaskTag ? runtime.settings.taskTag : undefined;

			const frontmatter = runtime.fieldMapper.mapToFrontmatter(
				completeTaskData,
				taskTagForFrontmatter,
				runtime.settings.storeTitleInFilename
			);

			if (runtime.settings.taskIdentificationMethod === "property") {
				const propName = runtime.settings.taskPropertyName;
				const propValue = runtime.settings.taskPropertyValue;
				if (propName && propValue) {
					applyPropertyTaskIdentifier(frontmatter, propName, propValue);
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

			let finalFrontmatter = mergeTemplateFrontmatter(
				frontmatter,
				templateResult.frontmatter
			);
			if (taskData.customFrontmatter) {
				finalFrontmatter = { ...finalFrontmatter, ...taskData.customFrontmatter };
			}
			if (runtime.settings.storeTitleInFilename) {
				delete finalFrontmatter[runtime.fieldMapper.toUserField("title")];
			}
			if (runtime.settings.taskIdentificationMethod === "property") {
				applyPropertyTaskIdentifier(
					finalFrontmatter,
					runtime.settings.taskPropertyName,
					runtime.settings.taskPropertyValue
				);
			}
			tagsArray = getFrontmatterTags(finalFrontmatter.tags);

			const yamlHeader = stringifyYaml(finalFrontmatter);
			let content = `---\n${yamlHeader}---\n\n`;
			if (normalizedBody.length > 0) {
				content += `${normalizedBody}\n`;
			}

			const file = await runtime.app.vault.create(fullPath, content);

			const taskInfo: TaskInfo = {
				...completeTaskData,
				...finalFrontmatter,
				title: stringifyUnknown(finalFrontmatter.title || completeTaskData.title || title),
				status: stringifyUnknown(
					finalFrontmatter.status || completeTaskData.status || status
				),
				priority: stringifyUnknown(
					finalFrontmatter.priority || completeTaskData.priority || priority
				),
				path: file.path,
				tags: tagsArray,
				archived: false,
				details: normalizedBody,
			};

			try {
				if (runtime.cacheManager.waitForFreshTaskData) {
					await runtime.cacheManager.waitForFreshTaskData(file);
				}
				runtime.cacheManager.updateTaskInfoInCache(file.path, taskInfo);
			} catch (cacheError) {
				tasknotesLogger.error("Error updating cache for new task:", {
					category: "stale-data",
					operation: "updating-cache-new-task",
					error: cacheError,
				});
			}

			runtime.emitter.trigger(EVENT_TASK_UPDATED, {
				path: file.path,
				updatedTask: taskInfo,
			});

			if (this.deps.webhookNotifier) {
				try {
					await this.deps.webhookNotifier.triggerWebhook("task.created", {
						task: taskInfo,
					});
				} catch (error) {
					tasknotesLogger.warn("Failed to trigger webhook for task creation:", {
						category: "provider",
						operation: "trigger-webhook-task-creation",
						error: error,
					});
				}
			}

			if (
				runtime.taskCalendarSyncService &&
				runtime.settings.googleCalendarExport.syncOnTaskCreate
			) {
				runtime.taskCalendarSyncService.syncTaskToCalendar(taskInfo).catch((error) => {
					tasknotesLogger.warn("Failed to sync task to Google Calendar:", {
						category: "provider",
						operation: "sync-task-google-calendar",
						error: error,
					});
				});
			}

			return { file, taskInfo };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			tasknotesLogger.error("Error creating task:", {
				category: "persistence",
				operation: "creating-task",
				details: { stack: error instanceof Error ? error.stack : undefined, taskData },
				error: errorMessage,
			});
			throw new Error(`Failed to create task: ${errorMessage}`);
		}
	}

	private resolveCurrentNoteFolderVariables(folderTemplate: string): string {
		if (
			!folderTemplate.includes("{{currentNotePath}}") &&
			!folderTemplate.includes("{{currentNoteTitle}}")
		) {
			return folderTemplate;
		}

		const currentFile = this.deps.runtime.app.workspace.getActiveFile();
		return folderTemplate
			.replace(/\{\{currentNotePath\}\}/g, currentFile?.parent?.path || "")
			.replace(/\{\{currentNoteTitle\}\}/g, currentFile?.basename || "");
	}

	private async resolveTargetFolder(taskData: TaskCreationData): Promise<string> {
		const { runtime } = this.deps;
		let folder = "";

		if (
			taskData.creationContext === "inline-conversion" ||
			taskData.creationContext === "modal-inline-creation"
		) {
			const inlineFolder = runtime.settings.inlineTaskConvertFolder || "";
			if (inlineFolder.trim()) {
				folder = this.resolveCurrentNoteFolderVariables(inlineFolder);
				return this.deps.processFolderTemplate(folder, taskData);
			}

			const tasksFolder = this.resolveCurrentNoteFolderVariables(
				runtime.settings.tasksFolder || ""
			);
			return this.deps.processFolderTemplate(tasksFolder, taskData);
		}

		const tasksFolder = this.resolveCurrentNoteFolderVariables(
			runtime.settings.tasksFolder || ""
		);
		return this.deps.processFolderTemplate(tasksFolder, taskData);
	}
}
