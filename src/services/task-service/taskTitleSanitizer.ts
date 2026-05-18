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
		console.error("Error sanitizing title:", error);
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
		console.error("Error sanitizing title:", error);
		return UNTITLED_TASK_TITLE;
	}
}
