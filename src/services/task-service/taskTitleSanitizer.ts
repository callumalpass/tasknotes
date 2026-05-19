import { createTaskNotesLogger } from "../../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/TaskService/TaskTitleSanitizer" });
const UNTITLED_TASK_TITLE = "untitled";

function stripControlCharacters(value: string): string {
	return value.replace(/./g, (char) => {
		const code = char.charCodeAt(0);
		return code <= 31 || (code >= 127 && code <= 159) ? "" : char;
	});
}

function normalizeTitleWhitespace(value: string): string {
	return value.trim().replace(/\s+/g, " ");
}

function fallbackUntitled(value: string): string {
	return value.length > 0 ? value : UNTITLED_TASK_TITLE;
}

export function sanitizeTaskTitleForFilename(input: string): string {
	if (!input || typeof input !== "string") {
		return UNTITLED_TASK_TITLE;
	}

	try {
		const sanitized = stripControlCharacters(normalizeTitleWhitespace(input))
			.replace(/[<>:"/\\|?*#[\]]/g, "")
			.replace(/^\.+|\.+$/g, "")
			.trim();

		return fallbackUntitled(sanitized);
	} catch (error) {
		tasknotesLogger.error("Error sanitizing title:", {
			category: "validation",
			operation: "sanitizing-title",
			error: error,
		});
		return UNTITLED_TASK_TITLE;
	}
}

export function sanitizeTaskTitleForStorage(input: string): string {
	if (!input || typeof input !== "string") {
		return UNTITLED_TASK_TITLE;
	}

	try {
		return fallbackUntitled(stripControlCharacters(normalizeTitleWhitespace(input)).trim());
	} catch (error) {
		tasknotesLogger.error("Error sanitizing title:", {
			category: "validation",
			operation: "sanitizing-title",
			error: error,
		});
		return UNTITLED_TASK_TITLE;
	}
}
