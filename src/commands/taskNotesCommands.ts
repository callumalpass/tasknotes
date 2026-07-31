import { Notice, type Editor } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TranslatedCommandDefinition } from "./types";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { showConfirmationModal } from "../modals/ConfirmationModal";

const tasknotesLogger = createTaskNotesLogger({ tag: "Commands/TaskNotesCommands" });

export function createTaskNotesCommandDefinitions(
	plugin: TaskNotesPlugin
): TranslatedCommandDefinition[] {
	return [
		{
			id: "open-calendar-view",
			nameKey: "commands.openCalendarView",
			callback: async (ctx) => {
				await ctx.activateCalendarView();
			},
		},
		{
			id: "open-advanced-calendar-view",
			nameKey: "commands.openAdvancedCalendarView",
			callback: async (ctx) => {
				await ctx.openBasesFileForCommand("open-advanced-calendar-view");
			},
		},
		{
			id: "open-tasks-view",
			nameKey: "commands.openTasksView",
			callback: async (ctx) => {
				await ctx.openBasesFileForCommand("open-tasks-view");
			},
		},
		{
			id: "open-agenda-view",
			nameKey: "commands.openAgendaView",
			callback: async (ctx) => {
				await ctx.openBasesFileForCommand("open-agenda-view");
			},
		},
		{
			id: "open-pomodoro-view",
			nameKey: "commands.openPomodoroView",
			callback: async (ctx) => {
				await ctx.activatePomodoroView();
			},
		},
		{
			id: "open-kanban-view",
			nameKey: "commands.openKanbanView",
			callback: async (ctx) => {
				await ctx.openBasesFileForCommand("open-kanban-view");
			},
		},
		{
			id: "update-default-base-files",
			nameKey: "commands.updateDefaultBaseFiles",
			callback: async (ctx) => {
				const confirmed = await showConfirmationModal(ctx.app, {
					title: ctx.i18n.translate(
						"settings.integrations.basesIntegration.updateDefaultFiles.confirmTitle"
					),
					message: ctx.i18n.translate(
						"settings.integrations.basesIntegration.updateDefaultFiles.confirmMessage"
					),
					confirmText: ctx.i18n.translate(
						"settings.integrations.basesIntegration.updateDefaultFiles.confirmText"
					),
					isDestructive: false,
				});

				if (!confirmed) {
					return;
				}

				await ctx.createDefaultBasesFiles({ overwriteExisting: true });
			},
		},
		{
			id: "open-pomodoro-stats",
			nameKey: "commands.openPomodoroStats",
			callback: async (ctx) => {
				await ctx.activatePomodoroStatsView();
			},
		},
		{
			id: "open-statistics",
			nameKey: "commands.openStatisticsView",
			callback: async (ctx) => {
				await ctx.activateStatsView();
			},
		},
		{
			id: "create-new-task",
			nameKey: "commands.createNewTask",
			callback: (ctx) => {
				ctx.openTaskCreationModal();
			},
		},
		{
			id: "convert-current-note-to-task",
			nameKey: "commands.convertCurrentNoteToTask.name",
			callback: async (ctx) => {
				await ctx.convertCurrentNoteToTask();
			},
		},
		{
			id: "convert-to-tasknote",
			nameKey: "commands.convertToTaskNote",
			editorCallback: async (ctx, editor: Editor) => {
				await ctx.convertTaskToTaskNote(editor);
			},
		},
		{
			id: "batch-convert-all-tasks",
			nameKey: "commands.convertAllTasksInNote",
			editorCallback: async (ctx, editor: Editor) => {
				await ctx.batchConvertAllTasks(editor);
			},
		},
		{
			id: "insert-tasknote-link",
			nameKey: "commands.insertTaskNoteLink",
			editorCallback: (ctx, editor: Editor) => {
				void ctx.insertTaskNoteLink(editor);
			},
		},
		{
			id: "create-inline-task",
			nameKey: "commands.createInlineTask",
			editorCallback: async (ctx, editor: Editor) => {
				await ctx.createInlineTask(editor);
			},
		},
		{
			id: "quick-actions-current-task",
			nameKey: "commands.quickActionsCurrentTask",
			callback: async (ctx) => {
				await ctx.openQuickActionsForCurrentTask();
			},
		},
		{
			id: "quick-actions-task-under-cursor",
			nameKey: "commands.quickActionsTaskUnderCursor",
			editorCallback: async (ctx, editor: Editor, view) => {
				await ctx.openQuickActionsForTaskUnderCursor(editor, view.file);
			},
		},
		{
			id: "edit-current-task",
			nameKey: "commands.editCurrentTask",
			callback: async (ctx) => {
				await ctx.openTaskEditModalForCurrentTask();
			},
		},
		{
			id: "cycle-current-task-status",
			nameKey: "commands.cycleCurrentTaskStatus",
			callback: async (ctx) => {
				await ctx.cycleCurrentTaskStatus();
			},
		},
		{
			id: "cycle-current-task-priority",
			nameKey: "commands.cycleCurrentTaskPriority",
			callback: async (ctx) => {
				await ctx.cycleCurrentTaskPriority();
			},
		},
		{
			id: "add-project-to-current-task",
			nameKey: "commands.addProjectToCurrentTask",
			callback: async (ctx) => {
				await ctx.addProjectToCurrentTask();
			},
		},
		{
			id: "add-subtask-to-current-note",
			nameKey: "commands.addSubtaskToCurrentNote",
			callback: async (ctx) => {
				await ctx.addSubtaskToCurrentNote();
			},
		},
		{
			id: "go-to-today",
			nameKey: "commands.goToTodayNote",
			callback: async (ctx) => {
				await ctx.navigateToCurrentDailyNote();
			},
		},
		{
			id: "start-pomodoro",
			nameKey: "commands.startPomodoro",
			callback: async (ctx) => {
				const state = ctx.pomodoroService.getState();
				if (state.currentSession && !state.isRunning) {
					await ctx.pomodoroService.resumePomodoro();
					return;
				}

				if (state.nextSessionType === "short-break") {
					await ctx.pomodoroService.startBreak(false);
				} else if (state.nextSessionType === "long-break") {
					await ctx.pomodoroService.startBreak(true);
				} else {
					await ctx.pomodoroService.startPomodoroWithLastSelectedTask();
				}
			},
		},
		{
			id: "stop-pomodoro",
			nameKey: "commands.stopPomodoro",
			callback: async (ctx) => {
				await ctx.pomodoroService.stopPomodoro();
			},
		},
		{
			id: "pause-pomodoro",
			nameKey: "commands.pauseResumePomodoro",
			callback: async (ctx) => {
				const state = ctx.pomodoroService.getState();
				if (state.isRunning) {
					await ctx.pomodoroService.pausePomodoro();
				} else if (state.currentSession) {
					await ctx.pomodoroService.resumePomodoro();
				}
			},
		},
		{
			id: "refresh-cache",
			nameKey: "commands.refreshCache",
			callback: async (ctx) => {
				await ctx.refreshCache();
			},
		},
		{
			id: "export-all-tasks-ics",
			nameKey: "commands.exportAllTasksIcs",
			callback: async (ctx) => {
				try {
					const allTasks = await ctx.cacheManager.getAllTasks();
					const { downloadAllTasksICSFile } = await import(
						"../ui/calendarExportActions"
					);
					downloadAllTasksICSFile(
						allTasks,
						ctx.i18n.translate.bind(ctx.i18n),
						{
							useDurationForExport:
								ctx.settings.icsIntegration.useDurationForExport ?? false,
							excludeArchived:
								ctx.settings.icsIntegration.excludeArchivedFromExport ?? false,
							excludeCompleted:
								ctx.settings.icsIntegration.excludeCompletedFromExport ?? false,
							completedStatuses: ctx.statusManager.getCompletedStatuses(),
							requireDueDate:
								ctx.settings.icsIntegration.requireDueDateForExport ?? false,
							requireScheduledDate:
								ctx.settings.icsIntegration.requireScheduledDateForExport ?? false,
							includeObsidianLink: true,
							vaultName: ctx.app.vault.getName(),
						}
					);
				} catch (error) {
					tasknotesLogger.error("Error exporting all tasks as ICS:", {
						category: "provider",
						operation: "exporting-all-tasks-as-ics",
						error: error,
					});
					new Notice(ctx.i18n.translate("notices.exportTasksFailed"));
				}
			},
		},
		{
			id: "sync-all-tasks-google-calendar",
			nameKey: "commands.syncAllTasksGoogleCalendar",
			callback: async (ctx) => {
				if (!ctx.taskCalendarSyncService?.isEnabled()) {
					new Notice(
						ctx.i18n.translate(
							"settings.integrations.googleCalendarExport.notices.notEnabled"
						)
					);
					return;
				}

				await ctx.taskCalendarSyncService.syncAllTasks();
			},
		},
		{
			id: "sync-current-task-google-calendar",
			nameKey: "commands.syncCurrentTaskGoogleCalendar",
			callback: async (ctx) => {
				if (!ctx.taskCalendarSyncService?.isEnabled()) {
					new Notice(
						ctx.i18n.translate(
							"settings.integrations.googleCalendarExport.notices.notEnabled"
						)
					);
					return;
				}

				const activeFile = ctx.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice(
						ctx.i18n.translate(
							"settings.integrations.googleCalendarExport.notices.noActiveFile"
						)
					);
					return;
				}

				const task = await ctx.cacheManager.getTaskInfo(activeFile.path);
				if (!task) {
					new Notice(
						ctx.i18n.translate(
							"settings.integrations.googleCalendarExport.notices.notATask"
						)
					);
					return;
				}

				if (!ctx.taskCalendarSyncService.shouldSyncTask(task)) {
					new Notice(
						ctx.i18n.translate(
							"settings.integrations.googleCalendarExport.notices.noDateToSync"
						)
					);
					return;
				}

				await ctx.taskCalendarSyncService.syncTaskToCalendar(task);
				new Notice(
					ctx.i18n.translate(
						"settings.integrations.googleCalendarExport.notices.taskSynced"
					)
				);
			},
		},
		{
			id: "view-release-notes",
			nameKey: "commands.viewReleaseNotes",
			callback: async (ctx) => {
				await ctx.activateReleaseNotesView();
			},
		},
		{
			id: "start-time-tracking-with-selector",
			nameKey: "commands.startTimeTrackingWithSelector",
			callback: async (ctx) => {
				await ctx.openTaskSelectorForTimeTracking();
			},
		},
		{
			id: "edit-time-entries",
			nameKey: "commands.editTimeEntries",
			callback: async (ctx) => {
				await ctx.openTaskSelectorForTimeEntryEditor();
			},
		},
		{
			id: "create-or-open-task",
			nameKey: "commands.createOrOpenTask",
			callback: async (ctx) => {
				await ctx.openTaskSelectorWithCreate();
			},
		},
		{
			id: "create-or-open-task-with-time-tracking",
			nameKey: "commands.createOrOpenTaskWithTracking",
			callback: async (ctx) => {
				await ctx.openTaskSelectorWithCreateAndStartTracking();
			},
		},
		{
			id: "rollover-overdue-scheduled-tasks",
			nameKey: "commands.rolloverOverdueScheduledTasks",
			callback: async (ctx) => {
				await ctx.rolloverOverdueScheduledTasks();
			},
		},
	];
}
