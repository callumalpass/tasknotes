import { msg } from "@lingui/core/macro";
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
			nameKey: msg({ message: "Open mini calendar view", context: "commands.openCalendarView" }),
			callback: async (ctx) => {
				await ctx.activateCalendarView();
			},
		},
		{
			id: "open-advanced-calendar-view",
			nameKey: msg({ message: "Open calendar view", context: "commands.openAdvancedCalendarView" }),
			callback: async (ctx) => {
				await ctx.openBasesFileForCommand("open-advanced-calendar-view");
			},
		},
		{
			id: "open-tasks-view",
			nameKey: msg({ message: "Open tasks view", context: "commands.openTasksView" }),
			callback: async (ctx) => {
				await ctx.openBasesFileForCommand("open-tasks-view");
			},
		},
		{
			id: "open-agenda-view",
			nameKey: msg({ message: "Open agenda view", context: "commands.openAgendaView" }),
			callback: async (ctx) => {
				await ctx.openBasesFileForCommand("open-agenda-view");
			},
		},
		{
			id: "open-pomodoro-view",
			nameKey: msg({ message: "Open Pomodoro timer", context: "commands.openPomodoroView" }),
			callback: async (ctx) => {
				await ctx.activatePomodoroView();
			},
		},
		{
			id: "open-kanban-view",
			nameKey: msg({ message: "Open Kanban board", context: "commands.openKanbanView" }),
			callback: async (ctx) => {
				await ctx.openBasesFileForCommand("open-kanban-view");
			},
		},
		{
			id: "update-default-base-files",
			nameKey: msg({ message: "Update default base files", context: "commands.updateDefaultBaseFiles" }),
			callback: async (ctx) => {
				const confirmed = await showConfirmationModal(ctx.app, {
					title: ctx.i18n.translate(
						msg({ message: "Update default base files", context: "settings.integrations.basesIntegration.updateDefaultFiles.confirmTitle" })
					),
					message: ctx.i18n.translate(
						msg({ message: "This will overwrite the configured default .base files with freshly generated templates. Any manual edits in those files will be replaced.", context: "settings.integrations.basesIntegration.updateDefaultFiles.confirmMessage" })
					),
					confirmText: ctx.i18n.translate(
						msg({ message: "Update files", context: "settings.integrations.basesIntegration.updateDefaultFiles.confirmText" })
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
			nameKey: msg({ message: "Open Pomodoro statistics", context: "commands.openPomodoroStats" }),
			callback: async (ctx) => {
				await ctx.activatePomodoroStatsView();
			},
		},
		{
			id: "open-statistics",
			nameKey: msg({ message: "Open task & project statistics", context: "commands.openStatisticsView" }),
			callback: async (ctx) => {
				await ctx.activateStatsView();
			},
		},
		{
			id: "create-new-task",
			nameKey: msg({ message: "Create new task", context: "commands.createNewTask" }),
			callback: (ctx) => {
				ctx.openTaskCreationModal();
			},
		},
		{
			id: "convert-current-note-to-task",
			nameKey: msg({ message: "Convert current note to task", context: "commands.convertCurrentNoteToTask.name" }),
			callback: async (ctx) => {
				await ctx.convertCurrentNoteToTask();
			},
		},
		{
			id: "convert-to-tasknote",
			nameKey: msg({ message: "Convert checkbox task to TaskNote", context: "commands.convertToTaskNote" }),
			editorCallback: async (ctx, editor: Editor) => {
				await ctx.convertTaskToTaskNote(editor);
			},
		},
		{
			id: "batch-convert-all-tasks",
			nameKey: msg({ message: "Convert all tasks in note", context: "commands.convertAllTasksInNote" }),
			editorCallback: async (ctx, editor: Editor) => {
				await ctx.batchConvertAllTasks(editor);
			},
		},
		{
			id: "insert-tasknote-link",
			nameKey: msg({ message: "Insert tasknote link", context: "commands.insertTaskNoteLink" }),
			editorCallback: (ctx, editor: Editor) => {
				void ctx.insertTaskNoteLink(editor);
			},
		},
		{
			id: "create-inline-task",
			nameKey: msg({ message: "Create new inline task", context: "commands.createInlineTask" }),
			editorCallback: async (ctx, editor: Editor) => {
				await ctx.createInlineTask(editor);
			},
		},
		{
			id: "quick-actions-current-task",
			nameKey: msg({ message: "Quick actions for current task", context: "commands.quickActionsCurrentTask" }),
			callback: async (ctx) => {
				await ctx.openQuickActionsForCurrentTask();
			},
		},
		{
			id: "quick-actions-task-under-cursor",
			nameKey: msg({ message: "Quick actions for task under cursor", context: "commands.quickActionsTaskUnderCursor" }),
			editorCallback: async (ctx, editor: Editor, view) => {
				await ctx.openQuickActionsForTaskUnderCursor(editor, view.file);
			},
		},
		{
			id: "edit-current-task",
			nameKey: msg({ message: "Edit current task", context: "commands.editCurrentTask" }),
			callback: async (ctx) => {
				await ctx.openTaskEditModalForCurrentTask();
			},
		},
		{
			id: "cycle-current-task-status",
			nameKey: msg({ message: "Cycle current task status", context: "commands.cycleCurrentTaskStatus" }),
			callback: async (ctx) => {
				await ctx.cycleCurrentTaskStatus();
			},
		},
		{
			id: "cycle-current-task-priority",
			nameKey: msg({ message: "Cycle current task priority", context: "commands.cycleCurrentTaskPriority" }),
			callback: async (ctx) => {
				await ctx.cycleCurrentTaskPriority();
			},
		},
		{
			id: "add-project-to-current-task",
			nameKey: msg({ message: "Add project to current task", context: "commands.addProjectToCurrentTask" }),
			callback: async (ctx) => {
				await ctx.addProjectToCurrentTask();
			},
		},
		{
			id: "add-subtask-to-current-note",
			nameKey: msg({ message: "Add subtask to current note", context: "commands.addSubtaskToCurrentNote" }),
			callback: async (ctx) => {
				await ctx.addSubtaskToCurrentNote();
			},
		},
		{
			id: "go-to-today",
			nameKey: msg({ message: "Go to today''s note", context: "commands.goToTodayNote" }),
			callback: async (ctx) => {
				await ctx.navigateToCurrentDailyNote();
			},
		},
		{
			id: "start-pomodoro",
			nameKey: msg({ message: "Start Pomodoro timer", context: "commands.startPomodoro" }),
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
			nameKey: msg({ message: "Stop Pomodoro timer", context: "commands.stopPomodoro" }),
			callback: async (ctx) => {
				await ctx.pomodoroService.stopPomodoro();
			},
		},
		{
			id: "pause-pomodoro",
			nameKey: msg({ message: "Pause/resume Pomodoro timer", context: "commands.pauseResumePomodoro" }),
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
			nameKey: msg({ message: "Refresh cache", context: "commands.refreshCache" }),
			callback: async (ctx) => {
				await ctx.refreshCache();
			},
		},
		{
			id: "export-all-tasks-ics",
			nameKey: msg({ message: "Export all tasks as ICS file", context: "commands.exportAllTasksIcs" }),
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
					new Notice(ctx.i18n.translate(msg({ message: "Failed to export tasks as ICS file", context: "notices.exportTasksFailed" })));
				}
			},
		},
		{
			id: "sync-all-tasks-google-calendar",
			nameKey: msg({ message: "Sync all tasks to Google Calendar", context: "commands.syncAllTasksGoogleCalendar" }),
			callback: async (ctx) => {
				if (!ctx.taskCalendarSyncService?.isEnabled()) {
					new Notice(
						ctx.i18n.translate(
							msg({ message: "Google Calendar export is not enabled. Configure it in Settings > Integrations.", context: "settings.integrations.googleCalendarExport.notices.notEnabled" })
						)
					);
					return;
				}

				await ctx.taskCalendarSyncService.syncAllTasks();
			},
		},
		{
			id: "sync-current-task-google-calendar",
			nameKey: msg({ message: "Sync current task to Google Calendar", context: "commands.syncCurrentTaskGoogleCalendar" }),
			callback: async (ctx) => {
				if (!ctx.taskCalendarSyncService?.isEnabled()) {
					new Notice(
						ctx.i18n.translate(
							msg({ message: "Google Calendar export is not enabled. Configure it in Settings > Integrations.", context: "settings.integrations.googleCalendarExport.notices.notEnabled" })
						)
					);
					return;
				}

				const activeFile = ctx.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice(
						ctx.i18n.translate(
							msg({ message: "No file is currently active", context: "settings.integrations.googleCalendarExport.notices.noActiveFile" })
						)
					);
					return;
				}

				const task = await ctx.cacheManager.getTaskInfo(activeFile.path);
				if (!task) {
					new Notice(
						ctx.i18n.translate(
							msg({ message: "Current file is not a task", context: "settings.integrations.googleCalendarExport.notices.notATask" })
						)
					);
					return;
				}

				if (!ctx.taskCalendarSyncService.shouldSyncTask(task)) {
					new Notice(
						ctx.i18n.translate(
							msg({ message: "Task has no scheduled or due date to sync", context: "settings.integrations.googleCalendarExport.notices.noDateToSync" })
						)
					);
					return;
				}

				await ctx.taskCalendarSyncService.syncTaskToCalendar(task);
				new Notice(
					ctx.i18n.translate(
						msg({ message: "Task synced to Google Calendar", context: "settings.integrations.googleCalendarExport.notices.taskSynced" })
					)
				);
			},
		},
		{
			id: "view-release-notes",
			nameKey: msg({ message: "View release notes", context: "commands.viewReleaseNotes" }),
			callback: async (ctx) => {
				await ctx.activateReleaseNotesView();
			},
		},
		{
			id: "start-time-tracking-current-task",
			nameKey: msg({ message: "Start time tracking for current task", context: "commands.startTimeTrackingCurrentTask" }),
			callback: async (ctx) => {
				await ctx.setCurrentTaskTimeTracking("start");
			},
		},
		{
			id: "stop-time-tracking-current-task",
			nameKey: msg({ message: "Stop time tracking for current task", context: "commands.stopTimeTrackingCurrentTask" }),
			callback: async (ctx) => {
				await ctx.setCurrentTaskTimeTracking("stop");
			},
		},
		{
			id: "stop-active-time-tracking",
			nameKey: msg({ message: "Stop active time tracking", context: "commands.stopActiveTimeTracking" }),
			callback: async (ctx) => {
				await ctx.stopActiveTimeTracking();
			},
		},
		{
			id: "start-time-tracking-with-selector",
			nameKey: msg({ message: "Start time tracking (select task)", context: "commands.startTimeTrackingWithSelector" }),
			callback: async (ctx) => {
				await ctx.openTaskSelectorForTimeTracking();
			},
		},
		{
			id: "edit-time-entries",
			nameKey: msg({ message: "Edit time entries (select task)", context: "commands.editTimeEntries" }),
			callback: async (ctx) => {
				await ctx.openTaskSelectorForTimeEntryEditor();
			},
		},
		{
			id: "create-or-open-task",
			nameKey: msg({ message: "Create or open task", context: "commands.createOrOpenTask" }),
			callback: async (ctx) => {
				await ctx.openTaskSelectorWithCreate();
			},
		},
		{
			id: "create-or-open-task-with-time-tracking",
			nameKey: msg({ message: "Create or open task and start time tracking", context: "commands.createOrOpenTaskWithTracking" }),
			callback: async (ctx) => {
				await ctx.openTaskSelectorWithCreateAndStartTracking();
			},
		},
		{
			id: "rollover-overdue-scheduled-tasks",
			nameKey: msg({ message: "Postpone overdue scheduled tasks to today", context: "commands.rolloverOverdueScheduledTasks" }),
			callback: async (ctx) => {
				await ctx.rolloverOverdueScheduledTasks();
			},
		},
	];
}
