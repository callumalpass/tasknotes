import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import type { TaskListKeyboardAction } from "../../bases/taskListKeyboardActions";

/** Lingui descriptors for the fork's configurable task-card shortcuts. */
export const keyboardShortcutMessages: Record<string, MessageDescriptor> = {
	"settings.keyboardShortcuts.header": msg({ message: "Task card keyboard shortcuts", context: "settings.keyboardShortcuts.header" }),
	"settings.keyboardShortcuts.description": msg({ message: "Configure shortcuts for task cards in the task list, Kanban, and agenda views, and for the task currently hovered in calendar grid views. They only run while a task has keyboard focus or is hovered.", context: "settings.keyboardShortcuts.description" }),
	"settings.keyboardShortcuts.actionDescription": msg({ message: "Click a shortcut to remove it, or add another binding.", context: "settings.keyboardShortcuts.actionDescription" }),
	"settings.keyboardShortcuts.remove": msg({ message: "Remove shortcut", context: "settings.keyboardShortcuts.remove" }),
	"settings.keyboardShortcuts.captureHint": msg({ message: "Click, then press the desired key combination", context: "settings.keyboardShortcuts.captureHint" }),
	"settings.keyboardShortcuts.recording": msg({ message: "Press keys…", context: "settings.keyboardShortcuts.recording" }),
	"settings.keyboardShortcuts.confirmTitle": msg({ message: "Add shortcut?", context: "settings.keyboardShortcuts.confirmTitle" }),
	"settings.keyboardShortcuts.confirmMessage": msg({ message: "Add {shortcut} to {action}?", context: "settings.keyboardShortcuts.confirmMessage" }),
	"settings.keyboardShortcuts.confirm": msg({ message: "Add", context: "settings.keyboardShortcuts.confirm" }),
	"settings.keyboardShortcuts.resetAction": msg({ message: "Reset this action", context: "settings.keyboardShortcuts.resetAction" }),
	"settings.keyboardShortcuts.resetAll": msg({ message: "Reset all shortcuts", context: "settings.keyboardShortcuts.resetAll" }),
	"settings.keyboardShortcuts.resetAllDescription": msg({ message: "Restore every task card shortcut to its default binding.", context: "settings.keyboardShortcuts.resetAllDescription" }),
	"settings.keyboardShortcuts.conflict": msg({ message: "Conflict: {shortcuts} is also assigned to another task card action.", context: "settings.keyboardShortcuts.conflict" }),
	"settings.keyboardShortcuts.duplicateTitle": msg({ message: "Shortcut already assigned", context: "settings.keyboardShortcuts.duplicateTitle" }),
	"settings.keyboardShortcuts.duplicateMessage": msg({ message: "{shortcut} is assigned to {actions}. Replace the existing assignment?", context: "settings.keyboardShortcuts.duplicateMessage" }),
	"settings.keyboardShortcuts.replace": msg({ message: "Replace", context: "settings.keyboardShortcuts.replace" }),
	"settings.keyboardShortcuts.addUserField": msg({ message: "Add user field", context: "settings.keyboardShortcuts.addUserField" }),
	"settings.keyboardShortcuts.addUserFieldDescription": msg({ message: "Add a shortcut for a configured user-defined task field.", context: "settings.keyboardShortcuts.addUserFieldDescription" }),
	"common.cancel": msg({ message: "Cancel", context: "common.cancel" }),
	"modals.task.timeEstimateLabel": msg({ message: "Time estimate", context: "modals.task.timeEstimateLabel" }),
	"settings.keyboardShortcuts.actions.navigate-next": msg({ message: "Focus next task", context: "settings.keyboardShortcuts.actions.navigate-next" }),
	"settings.keyboardShortcuts.actions.navigate-previous": msg({ message: "Focus previous task", context: "settings.keyboardShortcuts.actions.navigate-previous" }),
	"settings.keyboardShortcuts.actions.jump-first": msg({ message: "Jump to first task", context: "settings.keyboardShortcuts.actions.jump-first" }),
	"settings.keyboardShortcuts.actions.jump-last": msg({ message: "Jump to last task", context: "settings.keyboardShortcuts.actions.jump-last" }),
	"settings.keyboardShortcuts.actions.clear-focus-and-selection": msg({ message: "Clear focus and selection", context: "settings.keyboardShortcuts.actions.clear-focus-and-selection" }),
	"settings.keyboardShortcuts.actions.toggle-select": msg({ message: "Toggle focused task selection", context: "settings.keyboardShortcuts.actions.toggle-select" }),
	"settings.keyboardShortcuts.actions.select-all": msg({ message: "Select all visible tasks", context: "settings.keyboardShortcuts.actions.select-all" }),
	"settings.keyboardShortcuts.actions.copy-task-titles": msg({ message: "Copy task titles", context: "settings.keyboardShortcuts.actions.copy-task-titles" }),
	"settings.keyboardShortcuts.actions.toggle-archive": msg({ message: "Toggle archive", context: "settings.keyboardShortcuts.actions.toggle-archive" }),
	"settings.keyboardShortcuts.actions.create-task": msg({ message: "Create task", context: "settings.keyboardShortcuts.actions.create-task" }),
	"settings.keyboardShortcuts.actions.focus-search": msg({ message: "Focus search", context: "settings.keyboardShortcuts.actions.focus-search" }),
	"settings.keyboardShortcuts.actions.edit-task": msg({ message: "Edit task", context: "settings.keyboardShortcuts.actions.edit-task" }),
	"settings.keyboardShortcuts.actions.open-context-menu": msg({ message: "Open task context menu", context: "settings.keyboardShortcuts.actions.open-context-menu" }),
	"settings.keyboardShortcuts.actions.open-task-notes": msg({ message: "Open task note", context: "settings.keyboardShortcuts.actions.open-task-notes" }),
	"settings.keyboardShortcuts.actions.edit-due": msg({ message: "Edit due date", context: "settings.keyboardShortcuts.actions.edit-due" }),
	"settings.keyboardShortcuts.actions.edit-scheduled": msg({ message: "Edit scheduled date", context: "settings.keyboardShortcuts.actions.edit-scheduled" }),
	"settings.keyboardShortcuts.actions.edit-priority": msg({ message: "Edit priority", context: "settings.keyboardShortcuts.actions.edit-priority" }),
	"settings.keyboardShortcuts.actions.mark-complete": msg({ message: "Mark complete", context: "settings.keyboardShortcuts.actions.mark-complete" }),
	"settings.keyboardShortcuts.actions.edit-status": msg({ message: "Edit status", context: "settings.keyboardShortcuts.actions.edit-status" }),
	"settings.keyboardShortcuts.actions.edit-recurrence": msg({ message: "Edit recurrence", context: "settings.keyboardShortcuts.actions.edit-recurrence" }),
	"settings.keyboardShortcuts.actions.add-tags": msg({ message: "Add tags", context: "settings.keyboardShortcuts.actions.add-tags" }),
	"settings.keyboardShortcuts.actions.add-context": msg({ message: "Add context", context: "settings.keyboardShortcuts.actions.add-context" }),
	"settings.keyboardShortcuts.actions.add-project": msg({ message: "Add project", context: "settings.keyboardShortcuts.actions.add-project" }),
	"settings.keyboardShortcuts.actions.delete-tasks": msg({ message: "Delete tasks", context: "settings.keyboardShortcuts.actions.delete-tasks" }),
};

/** Resolves a stable shortcut action ID to an extractable Lingui descriptor. */
export function shortcutActionMessage(action: TaskListKeyboardAction): MessageDescriptor {
	return keyboardShortcutMessages[action === "edit-time-estimate"
		? "modals.task.timeEstimateLabel"
		: `settings.keyboardShortcuts.actions.${action}`];
}
