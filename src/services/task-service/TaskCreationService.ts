import { Notice, TFile, normalizePath, parseYaml, stringifyYaml } from "obsidian";
import {
	EVENT_TASK_UPDATED,
	IWebhookNotifier,
	TaskCreationData,
	TaskInfo,
} from "../../types";
import { addDTSTARTToRecurrenceRule } from "../../core/recurrence";
import { FilenameContext, generateTaskFilename, generateUniqueFilename } from "../../utils/filenameGenerator";
import { ensureFolderExists, splitFrontmatterAndBody } from "../../utils/helpers";
import { getCurrentTimestamp } from "../../utils/dateUtils";
import { mergeTemplateFrontmatter } from "../../utils/templateProcessor";
import { formatTaskTitle } from "../../utils/taskTitleFormatter";
import type TaskNotesPlugin from "../../main";
import {
	ExistingTaskNoteConflictDecision,
	showExistingTaskNoteConflictModal,
} from "../../modals/ExistingTaskNoteConflictModal";

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
	resolveExistingTaskNoteConflict?(options: {
		path: string;
		existingFrontmatter: Record<string, unknown>;
		incomingFrontmatter: Record<string, unknown>;
		existingBody: string;
		incomingBody: string;
	}): Promise<ExistingTaskNoteConflictDecision>;
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

			const targetPath = this.normalizeTargetPath(taskData.targetPath);
			const targetFolder = targetPath ? this.folderFromPath(targetPath) : "";
			const targetFilename = targetPath ? this.basenameFromPath(targetPath) : "";
			const baseFilename = targetFilename || generateTaskFilename(filenameContext, plugin.settings);
			const folder = targetPath ? targetFolder : await this.resolveTargetFolder(taskData);

			if (folder) {
				await ensureFolderExists(plugin.app.vault, folder);
			}

			let uniqueFilename = targetPath
				? baseFilename
				: await generateUniqueFilename(baseFilename, folder, plugin.app.vault);
			let fullPath = folder ? `${folder}/${uniqueFilename}.md` : `${uniqueFilename}.md`;

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

			// Thread user-defined field values from taskData through to frontmatter.
			// completeTaskData only lists hardcoded core fields, so we copy any user
			// field values here before mapToFrontmatter is called.
			const userFields = plugin.fieldMapper.getUserFields();
			if (userFields.length > 0) {
				const taskDataAny = taskData as Record<string, any>;
				const completeAny = completeTaskData as Record<string, any>;
				for (const field of userFields) {
					if (Object.prototype.hasOwnProperty.call(taskDataAny, field.key) && taskDataAny[field.key] !== undefined) {
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

			if (targetPath) {
				const existingFile = plugin.app.vault.getAbstractFileByPath(fullPath);
				if (existingFile instanceof TFile) {
					const behavior =
						plugin.settings.existingTaskNoteConflictBehavior || "ask";

					if (behavior === "create-unique") {
						uniqueFilename = await generateUniqueFilename(baseFilename, folder, plugin.app.vault);
						fullPath = folder ? `${folder}/${uniqueFilename}.md` : `${uniqueFilename}.md`;
					} else {
						const existingContent = await plugin.app.vault.read(existingFile);
						const existingParts = splitFrontmatterAndBody(existingContent);
						const existingFrontmatter = this.parseFrontmatter(existingParts.frontmatter);
						const existingBody = existingParts.body.replace(/\r\n/g, "\n").trimEnd();
						const decision =
							behavior === "reuse"
								? {
										action: "apply" as const,
										metadataChoice: "incoming" as const,
										bodyChoice: "existing" as const,
								  }
								: await this.resolveExistingTaskNoteConflict({
										path: fullPath,
										existingFrontmatter,
										incomingFrontmatter: finalFrontmatter,
										existingBody,
										incomingBody: normalizedBody,
								  });

						if (decision.action === "cancel") {
							throw new Error("TaskNote conversion cancelled");
						}

						if (decision.action === "create-unique") {
							uniqueFilename = await generateUniqueFilename(baseFilename, folder, plugin.app.vault);
							fullPath = folder ? `${folder}/${uniqueFilename}.md` : `${uniqueFilename}.md`;
						} else {
							const selectedFrontmatter =
								decision.metadataChoice === "existing"
									? existingFrontmatter
									: finalFrontmatter;
							const selectedBody =
								decision.bodyChoice === "existing" ? existingBody : normalizedBody;
							const content = this.buildTaskFileContent(selectedFrontmatter, selectedBody);
							await plugin.app.vault.modify(existingFile, content);

							const taskInfo = this.buildTaskInfo({
								completeTaskData,
								finalFrontmatter: selectedFrontmatter,
								title,
								status,
								priority,
								file: existingFile,
								tagsArray,
								normalizedBody: selectedBody,
							});
							await this.afterTaskWrite(existingFile, taskInfo);
							return { file: existingFile, taskInfo };
						}
					}
				}
			}

			const content = this.buildTaskFileContent(finalFrontmatter, normalizedBody);

			const file = await plugin.app.vault.create(fullPath, content);

			const taskInfo = this.buildTaskInfo({
				completeTaskData,
				finalFrontmatter,
				title,
				status,
				priority,
				file,
				tagsArray,
				normalizedBody,
			});

			await this.afterTaskWrite(file, taskInfo);

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
			if (errorMessage !== "TaskNote conversion cancelled") {
				console.error("Error creating task:", {
					error: errorMessage,
					stack: error instanceof Error ? error.stack : undefined,
					taskData,
				});
			}
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
			const currentFile = plugin.app.workspace.getActiveFile();
			const formatted = formatTaskTitle(
				{
					parsedTitle: taskData.title,
					sourcePath: currentFile?.path,
					sourceFolder: currentFile?.parent?.path,
					sourceBasename: currentFile?.basename,
					tags: taskData.tags,
					priority: taskData.priority,
					status: taskData.status,
				},
				plugin.settings.taskTitleFormatting
			);
			if (formatted.noteFolder) {
				return this.deps.processFolderTemplate(formatted.noteFolder, taskData);
			}

			const inlineFolder = plugin.settings.inlineTaskConvertFolder || "";
			if (inlineFolder.trim()) {
				folder = inlineFolder;
				if (
					inlineFolder.includes("{{currentNotePath}}") ||
					inlineFolder.includes("{{currentNoteTitle}}")
				) {
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

	private normalizeTargetPath(targetPath?: string): string {
		if (!targetPath?.trim()) {
			return "";
		}
		const normalized = normalizePath(targetPath.trim());
		return normalized.endsWith(".md") ? normalized : `${normalized}.md`;
	}

	private folderFromPath(path: string): string {
		const index = path.lastIndexOf("/");
		return index >= 0 ? path.substring(0, index) : "";
	}

	private basenameFromPath(path: string): string {
		const name = path.substring(path.lastIndexOf("/") + 1);
		return name.endsWith(".md") ? name.substring(0, name.length - 3) : name;
	}

	private async resolveExistingTaskNoteConflict(options: {
		path: string;
		existingFrontmatter: Record<string, unknown>;
		incomingFrontmatter: Record<string, unknown>;
		existingBody: string;
		incomingBody: string;
	}): Promise<ExistingTaskNoteConflictDecision> {
		if (this.deps.resolveExistingTaskNoteConflict) {
			return this.deps.resolveExistingTaskNoteConflict(options);
		}
		return showExistingTaskNoteConflictModal(this.deps.plugin.app, options);
	}

	private parseFrontmatter(frontmatterText: string | null): Record<string, unknown> {
		if (!frontmatterText) {
			return {};
		}
		try {
			const parsed = parseYaml(frontmatterText);
			return parsed && typeof parsed === "object" && !Array.isArray(parsed)
				? parsed as Record<string, unknown>
				: {};
		} catch {
			const fallback: Record<string, unknown> = {};
			for (const line of frontmatterText.split(/\r?\n/)) {
				const match = line.match(/^([^:#]+):\s*(.*)$/);
				if (match) {
					fallback[match[1].trim()] = match[2].trim();
				}
			}
			return fallback;
		}
	}

	private buildTaskFileContent(frontmatter: Record<string, unknown>, body: string): string {
		const yamlHeader = stringifyYaml(frontmatter);
		let content = `---\n${yamlHeader}---\n\n`;
		const normalizedBody = body.replace(/\r\n/g, "\n").trimEnd();
		if (normalizedBody.length > 0) {
			content += `${normalizedBody}\n`;
		}
		return content;
	}

	private async afterTaskWrite(file: TFile, taskInfo: TaskInfo): Promise<void> {
		const { plugin } = this.deps;
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
	}

	private buildTaskInfo({
		completeTaskData,
		finalFrontmatter,
		title,
		status,
		priority,
		file,
		tagsArray,
		normalizedBody,
	}: {
		completeTaskData: Partial<TaskInfo>;
		finalFrontmatter: Record<string, unknown>;
		title: string;
		status: string;
		priority: string;
		file: TFile;
		tagsArray: string[];
		normalizedBody: string;
	}): TaskInfo {
		return {
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
	}
}
