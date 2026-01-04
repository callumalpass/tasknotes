import { parseDateToUTC, isPastDate, isToday, formatDateForStorage } from "./dateUtils";

export interface ParsedTaskData {
	title: string;
	status?: string;
	priority?: string;
	dueDate?: string;
	scheduledDate?: string;
	dueTime?: string;
	scheduledTime?: string;
	startDate?: string;
	createdDate?: string;
	doneDate?: string;
	recurrence?: string;
	recurrenceData?: {
		frequency: string;
		days_of_week?: string[];
		day_of_month?: number;
		month_of_year?: number;
	};
	timeEstimate?: number;
	tags?: string[];
	contexts?: string[];
	projects?: string[];
	isCompleted: boolean;
	userFields?: Record<string, string | string[]>; // Custom user-defined fields
}

export interface TaskLineInfo {
	isTaskLine: boolean;
	originalText: string;
	parsedData?: ParsedTaskData;
	error?: string;
}

export class TasksPluginParser {
	// Emoji patterns for Tasks plugin
	private static readonly EMOJI_PATTERNS = {
		DUE_DATE: /📅\s*(\d{4}-\d{2}-\d{2})/g,
		SCHEDULED_DATE: /⏳\s*(\d{4}-\d{2}-\d{2})/g,
		START_DATE: /🛫\s*(\d{4}-\d{2}-\d{2})/g,
		CREATED_DATE: /➕\s*(\d{4}-\d{2}-\d{2})/g,
		DONE_DATE: /✅\s*(\d{4}-\d{2}-\d{2})/g,
		HIGH_PRIORITY: /⏫/g,
		MEDIUM_PRIORITY: /🔼/g,
		LOW_PRIORITY: /⏬/g,
		RECURRENCE: /🔁\s*([^📅⏳🛫➕✅⏫🔼⏬🔁#]+?)(?=\s*[📅⏳🛫➕✅⏫🔼⏬🔁#]|$)/gu,
	};

	// Tag pattern for hashtags (includes hyphens for tags like #my-tag)
	private static readonly TAG_PATTERN = /#[\w/-]+/g;

	// Checkbox pattern for markdown tasks (supports both bullet points and numbered lists)
	private static readonly CHECKBOX_PATTERN = /^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\]\s+)(.*)/;

	/**
	 * Parse a line of text to extract Tasks plugin format data
	 */
	static parseTaskLine(line: string): TaskLineInfo {
		// Validate input
		if (typeof line !== "string") {
			return {
				isTaskLine: false,
				originalText: "",
				error: "Invalid input: line must be a string",
			};
		}

		// Performance safeguard: skip extremely long lines
		if (line.length > 2000) {
			return {
				isTaskLine: false,
				originalText: line,
				error: "Line too long to process safely",
			};
		}

		const trimmedLine = line.trim();

		// Check if this is a checkbox task line
		const checkboxMatch = trimmedLine.match(this.CHECKBOX_PATTERN);
		if (!checkboxMatch) {
			return {
				isTaskLine: false,
				originalText: line,
			};
		}

		try {
			const [, , checkState, , taskContent] = checkboxMatch;

			// Validate extracted parts
			if (typeof checkState !== "string" || typeof taskContent !== "string") {
				return {
					isTaskLine: true,
					originalText: line,
					error: "Invalid checkbox format",
				};
			}

			const isCompleted = checkState.toLowerCase() === "x";

			// Parse the task content for emojis and metadata
			const parsedData = this.parseTaskContent(taskContent, isCompleted);

			// Validate parsed data
			if (!parsedData || !parsedData.title || parsedData.title.trim().length === 0) {
				return {
					isTaskLine: true,
					originalText: line,
					error: "Task must have a title",
				};
			}

			return {
				isTaskLine: true,
				originalText: line,
				parsedData,
			};
		} catch (error) {
			return {
				isTaskLine: true,
				originalText: line,
				error: `Failed to parse task: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	}

	/**
	 * Parse task content to extract emoji-based metadata
	 */
	private static parseTaskContent(content: string, isCompleted: boolean): ParsedTaskData {
		// Validate input
		if (typeof content !== "string") {
			throw new Error("Content must be a string");
		}

		// Performance safeguard
		if (content.length > 1000) {
			throw new Error("Content too long to process safely");
		}

		let workingContent = content;

		try {
			// Extract dates with validation
			const dueDate = this.extractDate(workingContent, this.EMOJI_PATTERNS.DUE_DATE);
			const scheduledDate = this.extractDate(
				workingContent,
				this.EMOJI_PATTERNS.SCHEDULED_DATE
			);
			const startDate = this.extractDate(workingContent, this.EMOJI_PATTERNS.START_DATE);
			const createdDate = this.extractDate(workingContent, this.EMOJI_PATTERNS.CREATED_DATE);
			const doneDate = this.extractDate(workingContent, this.EMOJI_PATTERNS.DONE_DATE);

			// Extract priority
			const priority = this.extractPriority(workingContent);

			// Extract recurrence
			const { recurrence, recurrenceData } = this.extractRecurrence(workingContent);

			// Extract tags
			const tags = this.extractTags(workingContent);

			// Remove all emoji patterns and tags to get clean title
			const title = this.extractCleanTitle(workingContent);

			// Validate title
			if (!title || title.trim().length === 0) {
				throw new Error("Title cannot be empty after parsing");
			}

			// Determine status based on completion and done date
			let status: string | undefined = undefined;
			if (isCompleted || doneDate) {
				status = "done";
			} else if (startDate) {
				try {
					// Use safe date comparison to check if start date is in the future
					if (!isPastDate(startDate) && !isToday(startDate)) {
						status = "scheduled";
					} else {
						// Start date exists but is today or past, so it's 'open'
						status = "open";
					}
				} catch {
					// Invalid start date, ignore for status determination
				}
			}
			// If no status-determining metadata found, leave status as undefined

			return {
				title: title.trim(),
				status,
				priority,
				dueDate,
				scheduledDate,
				startDate,
				createdDate,
				doneDate,
				recurrence,
				recurrenceData,
				tags: tags.length > 0 ? tags : undefined,
				projects: undefined, // TasksPlugin format doesn't have projects, only NLP fallback does
				isCompleted,
			};
		} catch (error) {
			throw new Error(
				`Failed to parse task content: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	}

	/**
	 * Extract date from content using pattern
	 */
	private static extractDate(content: string, pattern: RegExp): string | undefined {
		// Validate inputs
		if (typeof content !== "string" || !pattern) {
			return undefined;
		}

		try {
			// Create a fresh regex to avoid global state issues
			const freshPattern = new RegExp(pattern.source, "g");
			const match = freshPattern.exec(content);

			if (match && match[1]) {
				const dateString = match[1].trim();

				// Basic format validation before parsing
				if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
					return undefined;
				}

				// Validate date format and range
				try {
					// Use parseDateToUTC for consistent parsing
					const date = parseDateToUTC(dateString);

					// Check if date is valid and within reasonable range
					if (isNaN(date.getTime())) {
						return undefined;
					}

					const year = date.getUTCFullYear();
					if (year < 1900 || year > 2100) {
						return undefined;
					}

					return formatDateForStorage(date);
				} catch {
					return undefined;
				}
			}
		} catch (error) {
			console.debug("Error extracting date:", error);
		}

		return undefined;
	}

	/**
	 * Extract priority from content
	 */
	private static extractPriority(content: string): string | undefined {
		// Create fresh regex patterns to avoid global state issues
		if (new RegExp(this.EMOJI_PATTERNS.HIGH_PRIORITY.source).test(content)) {
			return "high";
		}
		if (new RegExp(this.EMOJI_PATTERNS.MEDIUM_PRIORITY.source).test(content)) {
			return "medium";
		}
		if (new RegExp(this.EMOJI_PATTERNS.LOW_PRIORITY.source).test(content)) {
			return "low";
		}
		// Return undefined instead of 'normal' when no priority emoji is found
		return undefined;
	}

	/**
	 * Extract recurrence information from content
	 */
	private static extractRecurrence(content: string): {
		recurrence?: string;
		recurrenceData?: any;
	} {
		// Create a fresh regex to avoid global state issues
		const freshPattern = new RegExp(this.EMOJI_PATTERNS.RECURRENCE.source, "g");
		const match = freshPattern.exec(content);

		if (!match || !match[1]) {
			return {};
		}

		const recurrenceText = match[1].trim();

		// Parse common recurrence patterns
		if (recurrenceText.includes("every day")) {
			return {
				recurrence: "daily",
				recurrenceData: { frequency: "daily" },
			};
		}

		if (recurrenceText.includes("every week")) {
			return {
				recurrence: "weekly",
				recurrenceData: { frequency: "weekly" },
			};
		}

		if (recurrenceText.includes("every month")) {
			return {
				recurrence: "monthly",
				recurrenceData: { frequency: "monthly" },
			};
		}

		if (recurrenceText.includes("every year")) {
			return {
				recurrence: "yearly",
				recurrenceData: { frequency: "yearly" },
			};
		}

		// Handle weekly with specific days
		const weeklyDaysMatch = recurrenceText.match(
			/every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
		);
		if (weeklyDaysMatch) {
			return {
				recurrence: "weekly",
				recurrenceData: {
					frequency: "weekly",
					days_of_week: [weeklyDaysMatch[1].toLowerCase().substring(0, 3)],
				},
			};
		}

		// Default to storing the raw recurrence text
		return {
			recurrence: "custom",
			recurrenceData: {
				frequency: "custom",
				raw: recurrenceText,
			},
		};
	}

	/**
	 * Extract tags from content
	 */
	private static extractTags(content: string): string[] {
		// Validate input
		if (typeof content !== "string") {
			return [];
		}

		try {
			// Create a fresh regex to avoid global state issues
			const freshPattern = new RegExp(this.TAG_PATTERN.source, "g");
			const tags: string[] = [];
			let match;

			while ((match = freshPattern.exec(content)) !== null) {
				if (match[0]) {
					// Remove the # prefix and add to tags array
					const tag = match[0].substring(1);
					if (tag && !tags.includes(tag)) {
						tags.push(tag);
					}
				}
			}

			return tags;
		} catch (error) {
			console.debug("Error extracting tags:", error);
			return [];
		}
	}

	/**
	 * Extract clean title by removing all emoji patterns and tags
	 */
	private static extractCleanTitle(content: string): string {
		// Validate input
		if (typeof content !== "string") {
			return "";
		}

		try {
			let cleanContent = content;

			// Remove all emoji patterns using fresh regex instances
			Object.values(this.EMOJI_PATTERNS).forEach((pattern) => {
				try {
					const freshPattern = new RegExp(pattern.source, "g");
					cleanContent = cleanContent.replace(freshPattern, "");
				} catch (error) {
					// If regex fails, continue with other patterns
					console.debug("Error applying emoji pattern:", error);
				}
			});

			// Remove tags using fresh regex instance
			try {
				const tagPattern = new RegExp(this.TAG_PATTERN.source, "g");
				cleanContent = cleanContent.replace(tagPattern, "");
			} catch (error) {
				console.debug("Error removing tags from title:", error);
			}

			// Clean up extra whitespace and validate result
			const cleaned = cleanContent.replace(/\s+/g, " ").trim();

			// Ensure we don't return an empty string
			if (cleaned.length === 0) {
				return "Untitled Task";
			}

			return cleaned;
		} catch (error) {
			console.debug("Error extracting clean title:", error);
			return "Untitled Task";
		}
	}

	/**
	 * Validate if a line contains Tasks plugin format
	 */
	static isTasksPluginFormat(line: string): boolean {
		// Validate input
		if (typeof line !== "string") {
			return false;
		}

		// Performance safeguard
		if (line.length > 1000) {
			return false;
		}

		try {
			const trimmedLine = line.trim();
			const hasCheckbox = this.CHECKBOX_PATTERN.test(trimmedLine);

			if (!hasCheckbox) return false;

			// Check for at least one Tasks plugin emoji using fresh regex instances
			const emojiPatterns = Object.values(this.EMOJI_PATTERNS);
			return emojiPatterns.some((pattern) => {
				try {
					const freshPattern = new RegExp(pattern.source);
					return freshPattern.test(trimmedLine);
				} catch {
					return false;
				}
			});
		} catch (error) {
			console.debug("Error validating Tasks plugin format:", error);
			return false;
		}
	}

	/**
	 * Get a human-readable summary of parsed data for debugging
	 */
	static getSummary(parsedData: ParsedTaskData): string {
		const parts: string[] = [];

		parts.push(`Title: "${parsedData.title}"`);
		parts.push(`Status: ${parsedData.status}`);
		parts.push(`Priority: ${parsedData.priority}`);

		if (parsedData.dueDate) parts.push(`Due: ${parsedData.dueDate}`);
		if (parsedData.startDate) parts.push(`Start: ${parsedData.startDate}`);
		if (parsedData.scheduledDate) parts.push(`Scheduled: ${parsedData.scheduledDate}`);
		if (parsedData.createdDate) parts.push(`Created: ${parsedData.createdDate}`);
		if (parsedData.doneDate) parts.push(`Done: ${parsedData.doneDate}`);
		if (parsedData.recurrence) parts.push(`Recurrence: ${parsedData.recurrence}`);
		if (parsedData.tags && parsedData.tags.length > 0)
			parts.push(`Tags: ${parsedData.tags.map((t) => "#" + t).join(", ")}`);
		if (parsedData.projects && parsedData.projects.length > 0)
			parts.push(
				`Projects: ${parsedData.projects.map((p) => (p.includes(" ") ? `+[[${p}]]` : `+${p}`)).join(", ")}`
			);

		return parts.join(" | ");
	}
}
