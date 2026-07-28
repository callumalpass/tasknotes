export type TaskListKeyboardAction =
	| "create-task"
	| "focus-search"
	| "edit-task"
	| "open-task-notes"
	| "edit-due"
	| "edit-scheduled"
	| "edit-priority"
	| "edit-status"
	| "edit-recurrence"
	| "add-tags"
	| "add-context"
	| "add-project"
	| "delete-tasks";

export function resolveDefaultTaskListKeyboardAction(
	event: Pick<
		KeyboardEvent,
		"key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing"
	>
): TaskListKeyboardAction | null {
	if (event.isComposing || event.key === "Process" || event.altKey) return null;

	const commandModifier = event.ctrlKey || event.metaKey;
	if (commandModifier) {
		return event.key === "Delete" ? "delete-tasks" : null;
	}

	if (event.shiftKey) {
		switch (event.key) {
			case "Enter":
				return "open-task-notes";
			case "S":
			case "s":
				return "edit-scheduled";
			case "#":
				return "add-tags";
			case "@":
				return "add-context";
			case "+":
				return "add-project";
			default:
				return null;
		}
	}

	switch (event.key.toLowerCase()) {
		case "c":
			return "create-task";
		case "/":
			return "focus-search";
		case "enter":
			return "edit-task";
		case "d":
			return "edit-due";
		case "p":
			return "edit-priority";
		case "s":
			return "edit-status";
		case "r":
			return "edit-recurrence";
		default:
			return null;
	}
}
