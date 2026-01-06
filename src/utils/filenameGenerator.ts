import { format } from "date-fns";
import { normalizePath } from "obsidian";
import { TaskNotesSettings } from "../types/settings";

export interface FilenameContext {
	title: string;
	priority: string;
	status: string;
	date?: Date;
	dueDate?: string; // YYYY-MM-DD format
	scheduledDate?: string; // YYYY-MM-DD format
	// Additional body template variables (optional for backwards compatibility)
	contexts?: string[];
	tags?: string[];
	timeEstimate?: number;
	details?: string;
	parentNote?: string;
}

export interface ICSFilenameContext extends FilenameContext {
	icsEventTitle?: string;
	icsEventLocation?: string;
	icsEventDescription?: string;
}

/**
 * Generates a filename for ICS event notes based on the configured format and context
 */
export function generateICSNoteFilename(
	context: ICSFilenameContext,
	settings: TaskNotesSettings
): string {
	// Validate inputs
	if (!context || !settings) {
		throw new Error("Invalid context or settings provided");
	}

	if (!context.title || typeof context.title !== "string") {
		throw new Error("Context must have a valid title");
	}

	// Validate title content
	if (context.title.trim().length === 0) {
		throw new Error("Title cannot be empty");
	}

	const now = context.date || new Date();

	// Validate date
	if (!(now instanceof Date) || isNaN(now.getTime())) {
		throw new Error("Invalid date provided in context");
	}

	try {
		// Use ICS-specific filename format if available
		const icsSettings = settings.icsIntegration;
		if (icsSettings) {
			switch (icsSettings.icsNoteFilenameFormat) {
				case "title":
					return sanitizeForFilename(context.title);

				case "zettel":
					return generateZettelId(now);

				case "timestamp":
					return generateTimestampFilename(now);

				case "custom": {
					// Create ICS-specific additional variables
					const icsVariables: Record<string, string> = {
						icsEventTitle: context.icsEventTitle
							? sanitizeForFilename(context.icsEventTitle)
							: sanitizeForFilename(context.title),
						icsEventLocation: context.icsEventLocation
							? sanitizeForFilename(context.icsEventLocation)
							: "",
						icsEventDescription: context.icsEventDescription
							? sanitizeForFilename(context.icsEventDescription.substring(0, 50))
							: "",
						// Add formatted title with date for users who want the full context
						icsEventTitleWithDate: sanitizeForFilename(
							`${context.icsEventTitle || context.title} - ${format(now, "PPP")}`
						),
					};
					return generateCustomFilename(
						context,
						icsSettings.customICSNoteFilenameTemplate,
						now,
						icsVariables
					);
				}

				default:
					// Fallback to title format for ICS notes
					return sanitizeForFilename(context.title);
			}
		}

		// Fallback to title format if no ICS settings
		return sanitizeForFilename(context.title);
	} catch (error) {
		console.error("Error generating ICS note filename:", error);
		// Fallback to safe title format
		return sanitizeForFilename(context.title);
	}
}

/**
 * Generates a filename based on the configured format and context
 */
export function generateTaskFilename(
	context: FilenameContext,
	settings: TaskNotesSettings
): string {
	// Validate inputs
	if (!context || !settings) {
		throw new Error("Invalid context or settings provided");
	}

	if (!context.title || typeof context.title !== "string") {
		throw new Error("Context must have a valid title");
	}

	// Validate title content
	if (context.title.trim().length === 0) {
		throw new Error("Title cannot be empty");
	}

	const now = context.date || new Date();

	// Validate date
	if (!(now instanceof Date) || isNaN(now.getTime())) {
		throw new Error("Invalid date provided in context");
	}

	if (settings.storeTitleInFilename) {
		return sanitizeForFilename(context.title);
	}

	try {
		switch (settings.taskFilenameFormat) {
			case "title":
				return sanitizeForFilename(context.title);

			case "zettel":
				return generateZettelId(now);

			case "timestamp":
				return generateTimestampFilename(now);

			case "custom":
				return generateCustomFilename(context, settings.customFilenameTemplate, now);

			default:
				// Fallback to zettel format
				return generateZettelId(now);
		}
	} catch (error) {
		console.error("Error generating filename:", error);
		// Fallback to safe zettel format
		return generateZettelId(now);
	}
}

/**
 * Generates the traditional zettelkasten ID (YYMMDD + base36 seconds since midnight)
 */
function generateZettelId(date: Date): string {
	const datePart = format(date, "yyMMdd");

	// Calculate seconds since midnight
	const midnight = new Date(date);
	midnight.setHours(0, 0, 0, 0);
	const secondsSinceMidnight = Math.floor((date.getTime() - midnight.getTime()) / 1000);

	// Convert to base36 for compactness
	const randomPart = secondsSinceMidnight.toString(36);

	return `${datePart}${randomPart}`;
}

/**
 * Generates a timestamp-based filename (YYYY-MM-DD-HHMMSS)
 */
function generateTimestampFilename(date: Date): string {
	return format(date, "yyyy-MM-dd-HHmmss");
}

/**
 * Generates a filename based on a custom template
 */
function generateCustomFilename(
	context: FilenameContext,
	template: string,
	date: Date,
	additionalVariables?: Record<string, string>
): string {
	// Validate inputs
	if (!context || !template || !date) {
		throw new Error("Invalid inputs for custom filename generation");
	}

	if (typeof template !== "string" || template.trim().length === 0) {
		throw new Error("Template must be a non-empty string");
	}

	if (!(date instanceof Date) || isNaN(date.getTime())) {
		throw new Error("Invalid date for filename generation");
	}

	try {
		// Validate and sanitize context values
		const sanitizedTitle = sanitizeForFilename(context.title);
		const sanitizedPriority =
			context.priority && ["low", "normal", "medium", "high"].includes(context.priority)
				? context.priority
				: "normal";
		const sanitizedStatus =
			context.status && ["open", "in-progress", "done", "scheduled"].includes(context.status)
				? context.status
				: "open";

		// Process array values for contexts and tags
		const contexts = Array.isArray(context.contexts) ? context.contexts : [];
		const tags = Array.isArray(context.tags) ? context.tags : [];

		const variables: Record<string, string> = {
			title: sanitizedTitle,
			date: format(date, "yyyy-MM-dd"),
			time: format(date, "HHmmss"),
			priority: sanitizedPriority,
			status: sanitizedStatus,
			timestamp: format(date, "yyyy-MM-dd-HHmmss"),
			dateTime: format(date, "yyyy-MM-dd-HHmm"),
			year: format(date, "yyyy"),
			month: format(date, "MM"),
			day: format(date, "dd"),
			hour: format(date, "HH"),
			minute: format(date, "mm"),
			second: format(date, "ss"),
			dueDate: context.dueDate || "",
			scheduledDate: context.scheduledDate || "",
			// Body template variables (contexts, tags, etc.)
			context: contexts[0] ? sanitizeForFilename(contexts[0]) : "",
			contexts: contexts.map((c) => sanitizeForFilename(c)).join("/"),
			tags: tags.map((t) => sanitizeForFilename(t)).join(", "),
			hashtags: tags.map((t) => `#${sanitizeForFilename(t)}`).join(" "),
			timeEstimate: context.timeEstimate?.toString() || "",
			details: context.details ? sanitizeForFilename(context.details.substring(0, 50)) : "",
			parentNote: context.parentNote ? sanitizeForFilename(context.parentNote) : "",
			// New date format variations
			shortDate: format(date, "yyMMdd"),
			shortYear: format(date, "yy"),
			monthName: format(date, "MMMM"),
			monthNameShort: format(date, "MMM"),
			dayName: format(date, "EEEE"),
			dayNameShort: format(date, "EEE"),
			week: format(date, "ww"),
			quarter: format(date, "q"),
			// Time variations
			time12: format(date, "hh:mm a"),
			time24: format(date, "HH:mm"),
			hourPadded: format(date, "HH"),
			hour12: format(date, "hh"),
			ampm: format(date, "a"),
			// Unix timestamp
			unix: Math.floor(date.getTime() / 1000).toString(),
			unixMs: date.getTime().toString(),
			// Milliseconds and timezone support for ISO 8601 format
			milliseconds: format(date, "SSS"),
			ms: format(date, "SSS"),
			timezone: format(date, "xxx"), // UTC offset in format ±HH:MM
			timezoneShort: format(date, "xx"), // UTC offset in format ±HHMM
			utcOffset: format(date, "xxx"), // UTC offset in format ±HH:MM
			utcOffsetShort: format(date, "xx"), // UTC offset in format ±HHMM
			utcZ: "Z", // Always 'Z' for Google Keep format (assumes UTC time)
			// Priority and status variations
			priorityShort: sanitizedPriority.substring(0, 1).toUpperCase(),
			statusShort: sanitizedStatus.substring(0, 1).toUpperCase(),
			// Title variations
			titleLower: sanitizedTitle.toLowerCase(),
			titleUpper: sanitizedTitle.toUpperCase(),
			titleSnake: sanitizedTitle.toLowerCase().replace(/\s+/g, "_"),
			titleKebab: sanitizedTitle.toLowerCase().replace(/\s+/g, "-"),
			titleCamel: sanitizedTitle
				.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
					index === 0 ? word.toLowerCase() : word.toUpperCase()
				)
				.replace(/\s+/g, ""),
			titlePascal: sanitizedTitle
				.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
				.replace(/\s+/g, ""),
			// Date-based identifiers
			zettel: generateZettelId(date),
			nano: Date.now().toString() + Math.random().toString(36).substring(2, 7),

			// Merge any additional variables
			...(additionalVariables || {}),
		};

		let result = template;

		// Validate template length
		if (template.length > 500) {
			throw new Error("Template too long");
		}

		// Replace all variables in the template
		// Support both {{variable}} (preferred) and {variable} (legacy) syntax
		Object.entries(variables).forEach(([key, value]) => {
			try {
				// First: Replace double-brace syntax {{variable}} (preferred, consistent with body templates)
				const doubleRegex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
				result = result.replace(doubleRegex, value);

				// Second: Replace single-brace syntax {variable} (legacy, backwards compatibility)
				const singleRegex = new RegExp(`\\{${key}\\}`, "g");
				result = result.replace(singleRegex, value);
			} catch (regexError) {
				console.warn(`Error replacing template variable ${key}:`, regexError);
			}
		});

		// Clean up any remaining unreplaced variables (both syntaxes)
		result = result.replace(/\{\{[^}]+\}\}/g, ""); // {{variable}}
		result = result.replace(/\{[^}]+\}/g, ""); // {variable}

		// Ensure we have a valid filename
		if (!result.trim()) {
			result = sanitizedTitle || generateZettelId(date);
		}

		return sanitizeForFilename(result);
	} catch (error) {
		console.error("Error generating custom filename:", error);
		// Fallback to safe title-based filename
		return sanitizeForFilename(context.title) || generateZettelId(date);
	}
}

/**
 * Sanitizes a string to be safe for use as a filename
 */
export function sanitizeForFilename(input: string): string {
	if (!input || typeof input !== "string") {
		return "untitled";
	}

	try {
		// Remove or replace problematic characters
		let sanitized = input
			.trim()
			// Replace multiple spaces with single space
			.replace(/\s+/g, " ")
			// Remove characters that are problematic in filenames (but keep spaces!)
			.replace(/[<>:"/\\|?*#[\]]/g, "")
			// Remove control characters separately
			.replace(/./g, (char) => {
				const code = char.charCodeAt(0);
				return code <= 31 || (code >= 127 && code <= 159) ? "" : char;
			})
			// Remove leading/trailing dots
			.replace(/^\.+|\.+$/g, "")
			// Final trim in case we removed characters at the edges
			.trim();

		// Additional validation
		if (!sanitized || sanitized.length === 0) {
			sanitized = "untitled";
		}

		// Validate against reserved names (Windows)
		const reservedNames = [
			"CON",
			"PRN",
			"AUX",
			"NUL",
			"COM1",
			"COM2",
			"COM3",
			"COM4",
			"COM5",
			"COM6",
			"COM7",
			"COM8",
			"COM9",
			"LPT1",
			"LPT2",
			"LPT3",
			"LPT4",
			"LPT5",
			"LPT6",
			"LPT7",
			"LPT8",
			"LPT9",
		];
		if (reservedNames.includes(sanitized.toUpperCase())) {
			sanitized = `task-${sanitized}`;
		}

		return sanitized;
	} catch (error) {
		console.error("Error sanitizing filename:", error);
		return "untitled";
	}
}

/**
 * Checks if a filename would be valid and unique
 */
export function validateFilename(filename: string): {
	isValid: boolean;
	error?: string;
	sanitized?: string;
} {
	if (!filename || !filename.trim()) {
		return {
			isValid: false,
			error: "Filename cannot be empty",
		};
	}

	const sanitized = sanitizeForFilename(filename);

	if (!sanitized) {
		return {
			isValid: false,
			error: "Filename contains only invalid characters",
		};
	}

	if (sanitized.length > 255) {
		return {
			isValid: false,
			error: "Filename is too long (max 255 characters)",
		};
	}

	return {
		isValid: true,
		sanitized,
	};
}

/**
 * Generates a unique filename by appending a number if needed
 */
export async function generateUniqueFilename(
	baseFilename: string,
	folderPath: string,
	vault: any // Obsidian Vault
): Promise<string> {
	// Validate inputs
	if (!baseFilename || typeof baseFilename !== "string") {
		throw new Error("Base filename must be a non-empty string");
	}

	if (typeof folderPath !== "string") {
		throw new Error("Folder path must be a string");
	}

	if (!vault) {
		throw new Error("Vault must be provided");
	}

	// Sanitize inputs
	const sanitizedFilename = sanitizeForFilename(baseFilename);
	if (!sanitizedFilename) {
		throw new Error("Base filename cannot be sanitized to a valid name");
	}

	// Validate folder path
	const sanitizedFolderPath = folderPath.replace(/\.\./g, "").trim();

	try {
		const basePath = normalizePath(`${sanitizedFolderPath}/${sanitizedFilename}.md`);

		// Validate path length
		if (basePath.length > 260) {
			// Windows path limit
			throw new Error("Generated path too long");
		}

		// Check if the base filename is available
		if (!vault.getAbstractFileByPath(basePath)) {
			return sanitizedFilename;
		}

		// If not, try appending numbers
		for (let i = 2; i <= 999; i++) {
			const candidateFilename = `${sanitizedFilename}-${i}`;
			const candidatePath = normalizePath(`${sanitizedFolderPath}/${candidateFilename}.md`);

			// Check path length for each candidate
			if (candidatePath.length > 260) {
				break; // Stop if paths become too long
			}

			if (!vault.getAbstractFileByPath(candidatePath)) {
				return candidateFilename;
			}
		}

		// If we get here, generate a unique ID fallback
		const timestamp = Date.now().toString(36);
		const fallbackFilename = `${sanitizedFilename.substring(0, 50)}-${timestamp}`;

		return sanitizeForFilename(fallbackFilename);
	} catch (error) {
		console.error("Error generating unique filename:", error);
		// Final fallback with timestamp
		const timestamp = Date.now().toString(36);
		return `task-${timestamp}`;
	}
}
