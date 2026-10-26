import { msg } from "@lingui/core/macro";
import { uiText } from "./runtime";

// Stored English seeds remain data. Only an unchanged seed gets a display label.
export function reminderDescriptionLabel(description: string | undefined): string {
	return description === "Reminder" ? uiText(msg({ message: "Reminder", context: "settings.defaults.reminders.defaultDescription" })) : description ?? "";
}
export function calendarNameLabel(name: string): string {
	return name === "New calendar" ? uiText(msg({ message: "New calendar", context: "settings.integrations.subscriptionsList.newCalendarName" })) : name;
}
export function newConfigLabel(label: string, kind: "status" | "priority"): string {
	if (kind === "status" && label === "New status") return uiText(msg({ message: "New status", context: "services/StatusManager: StatusManager.createDefaultStatus label" }));
	if (kind === "priority" && label === "New priority") return uiText(msg({ message: "New priority", context: "services/PriorityManager: PriorityManager.createDefaultPriority label" }));
	return label;
}
