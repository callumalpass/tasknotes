import { RRule } from "rrule";
import { parseDateToUTC, isPastDate, isToday, formatDateForStorage } from "./dateUtils";
import { createTaskNotesLogger } from "./tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Utils/TasksPluginParser" });

type RecurrenceAnchor = "scheduled" | "completion";

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
	recurrenceAnchor?: RecurrenceAnchor;
	recurrenceData?: {
		frequency: string;
		days_of_week?: string[];
		day_of_month?: number;
		month_of_year?: number;
		raw?: string;
	};
	timeEstimate?: number;
	tags?: string[];
	contexts?: string[];
	projects?: string[];
	isCompleted: boolean;
	userFields?: Record<string, string | string[]>; // Custom user-defined fields
	customFrontmatter?: Record<string, string | string[]>;
	details?: string;
	blockLink?: string;
	taskPluginId?: string;
	dependsOn?: string[];
	onCompletion?: "keep" | "delete";
}

export interface TaskLineInfo {
	isTaskLine: boolean;
	originalText: string;
	parsedData?: ParsedTaskData;
	error?: string;
}

interface ParsingState {
	line: string;
	parsed: Partial<ParsedTaskData>;
}

interface RecurrenceParseResult {
	recurrence?: string;
	recurrenceAnchor?: RecurrenceAnchor;
	recurrenceData?: ParsedTaskData["recurrenceData"];
}

const DAY_CODES: Record<string, string> = {
	monday: "MO",
	tuesday: "TU",
	wednesday: "WE",
	thursday: "TH",
	friday: "FR",
	saturday: "SA",
	sunday: "SU",
};

const PRIORITY_ALIASES: Record<string, string> = {
	"🔺": "highest",
	"⏫": "high",
	"🔼": "medium",
	"🔽": "low",
	"⏬": "lowest",
	highest: "highest",
	high: "high",
	medium: "medium",
	normal: "normal",
	none: "none",
	low: "low",
	lowest: "lowest",
};

export class TasksPluginParser {
	// Checkbox pattern for markdown tasks (supports both bullet points and numbered lists)
	private static readonly CHECKBOX_PATTERN =
		/^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\]\s+)(.*)/u;

	private static readonly TAG_PATTERN = /#[\p{L}\p{N}\p{M}_/-]+/gu;
	private static readonly CONTEXT_PATTERN = /@[\p{L}\p{N}\p{M}_/-]+/gu;
	private static readonly BLOCK_LINK_PATTERN = /\s(\^[a-zA-Z0-9-]+)\s*$/u;
	private static readonly TRAILING_TAG_OR_CONTEXT_PATTERN =
		/(?:^|\s)(#[\p{L}\p{N}\p{M}_/-]+|@[\p{L}\p{N}\p{M}_/-]+)\s*$/u;
	private static readonly DATAVIEW_FIELD_AT_END_PATTERN =
		/(?:^|\s)(\[|\()\s*([A-Za-z][A-Za-z0-9_-]*)::\s*([^\])]*?)\s*(\]|\))\s*,?\s*$/u;
	private static readonly DATAVIEW_FIELD_ANY_PATTERN =
		/(\[|\()\s*[A-Za-z][A-Za-z0-9_-]*::\s*[^\])]*?\s*(\]|\))/u;

	private static stripBlockquoteMarkers(line: string): string {
		let content = line.trim();
		while (/^>\s*/.test(content)) {
			content = content.replace(/^>\s*/, "");
		}
		return content;
	}

	/**
	 * Parse a line of text to extract Tasks plugin format data.
	 */
	static parseTaskLine(line: string): TaskLineInfo {
		if (typeof line !== "string") {
			return {
				isTaskLine: false,
				originalText: "",
				error: "Invalid input: line must be a string",
			};
		}

		if (line.length > 2000) {
			return {
				isTaskLine: false,
				originalText: line,
				error: "Line too long to process safely",
			};
		}

		const trimmedLine = this.stripBlockquoteMarkers(line);
		const checkboxMatch = trimmedLine.match(this.CHECKBOX_PATTERN);
		if (!checkboxMatch) {
			return {
				isTaskLine: false,
				originalText: line,
			};
		}

		try {
			const [, , checkState, , taskContent] = checkboxMatch;
			if (typeof checkState !== "string" || typeof taskContent !== "string") {
				return {
					isTaskLine: true,
					originalText: line,
					error: "Invalid checkbox format",
				};
			}

			const isCompleted = checkState.toLowerCase() === "x";
			const parsedData = this.parseTaskContent(taskContent, isCompleted);

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

	private static parseTaskContent(content: string, isCompleted: boolean): ParsedTaskData {
		if (typeof content !== "string") {
			throw new Error("Content must be a string");
		}

		if (content.length > 1000) {
			throw new Error("Content too long to process safely");
		}

		try {
			const state: ParsingState = {
				line: content.trim(),
				parsed: {},
			};

			const blockLink = this.consumeBlockLink(state);
			if (blockLink) {
				state.parsed.blockLink = blockLink;
			}

			this.consumeTrailingFields(state);

			const tags = this.extractTags(content);
			const contexts = this.extractContexts(content);
			const title = this.extractCleanTitle(state.line);

			let status: string | undefined = undefined;
			if (isCompleted || state.parsed.doneDate) {
				status = "done";
			} else if (state.parsed.startDate) {
				try {
					status =
						!isPastDate(state.parsed.startDate) && !isToday(state.parsed.startDate)
							? "scheduled"
							: "open";
				} catch {
					// Invalid start date, ignore for status determination.
				}
			}

			return {
				title: title.trim() || "Untitled Task",
				status,
				priority: state.parsed.priority,
				dueDate: state.parsed.dueDate,
				scheduledDate: state.parsed.scheduledDate,
				startDate: state.parsed.startDate,
				createdDate: state.parsed.createdDate,
				doneDate: state.parsed.doneDate,
				recurrence: state.parsed.recurrence,
				recurrenceAnchor: state.parsed.recurrenceAnchor,
				recurrenceData: state.parsed.recurrenceData,
				tags: tags.length > 0 ? tags : undefined,
				contexts: contexts.length > 0 ? contexts : undefined,
				projects: undefined,
				isCompleted,
				userFields: state.parsed.userFields,
				customFrontmatter: state.parsed.customFrontmatter,
				details: state.parsed.details,
				blockLink: state.parsed.blockLink,
				taskPluginId: state.parsed.taskPluginId,
				dependsOn: state.parsed.dependsOn,
				onCompletion: state.parsed.onCompletion,
			};
		} catch (error) {
			throw new Error(
				`Failed to parse task content: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	}

	private static consumeTrailingFields(state: ParsingState): void {
		let runs = 0;
		let matched = false;

		do {
			matched =
				this.consumeDataviewField(state) ||
				this.consumeEmojiField(state) ||
				this.consumeTrailingTagOrContext(state);
			runs++;
		} while (matched && runs <= 50);
	}

	private static consumeBlockLink(state: ParsingState): string | undefined {
		const match = state.line.match(this.BLOCK_LINK_PATTERN);
		if (!match?.[1]) {
			return undefined;
		}

		state.line = state.line.replace(this.BLOCK_LINK_PATTERN, "").trim();
		return match[1];
	}

	private static consumeTrailingTagOrContext(state: ParsingState): boolean {
		if (!this.TRAILING_TAG_OR_CONTEXT_PATTERN.test(state.line)) {
			return false;
		}

		state.line = state.line.replace(this.TRAILING_TAG_OR_CONTEXT_PATTERN, "").trim();
		return true;
	}

	private static consumeEmojiField(state: ParsingState): boolean {
		const consumers: Array<() => boolean> = [
			() => this.consumeEmojiDateField(state, /(?:📅|📆|🗓)\uFE0F?\s*(\d{4}-\d{2}-\d{2})\s*$/u, "dueDate"),
			() => this.consumeEmojiDateField(state, /(?:⏳|⌛)\uFE0F?\s*(\d{4}-\d{2}-\d{2})\s*$/u, "scheduledDate"),
			() => this.consumeEmojiDateField(state, /🛫\uFE0F?\s*(\d{4}-\d{2}-\d{2})\s*$/u, "startDate"),
			() => this.consumeEmojiDateField(state, /➕\uFE0F?\s*(\d{4}-\d{2}-\d{2})\s*$/u, "createdDate"),
			() => this.consumeEmojiDateField(state, /✅\uFE0F?\s*(\d{4}-\d{2}-\d{2})\s*$/u, "doneDate"),
			() => this.consumePriorityField(state, /(🔺|⏫|🔼|🔽|⏬)\uFE0F?\s*$/u),
			() => this.consumeRecurrenceField(state, /🔁\uFE0F?\s*([a-zA-Z0-9, !]+?)\s*$/u),
			() => this.consumeOnCompletionField(state, /🏁\uFE0F?\s*([a-zA-Z]+)\s*$/u),
			() => this.consumeTaskPluginIdField(state, /🆔\uFE0F?\s*([A-Za-z0-9_-]+)\s*$/u),
			() => this.consumeDependsOnField(state, /⛔\uFE0F?\s*([A-Za-z0-9_ -]+(?:\s*,\s*[A-Za-z0-9_-]+)*)\s*$/u),
		];

		return consumers.some((consumer) => consumer());
	}

	private static consumeEmojiDateField(
		state: ParsingState,
		regex: RegExp,
		field: "dueDate" | "scheduledDate" | "startDate" | "createdDate" | "doneDate"
	): boolean {
		return this.consumeField(state, regex, (match) => {
			const date = this.normalizeDate(match[1]);
			if (date) {
				state.parsed[field] = date;
			}
		});
	}

	private static consumePriorityField(state: ParsingState, regex: RegExp): boolean {
		return this.consumeField(state, regex, (match) => {
			state.parsed.priority = this.normalizePriority(match[1]);
		});
	}

	private static consumeRecurrenceField(state: ParsingState, regex: RegExp): boolean {
		return this.consumeField(state, regex, (match) => {
			Object.assign(state.parsed, this.parseRecurrence(match[1]));
		});
	}

	private static consumeOnCompletionField(state: ParsingState, regex: RegExp): boolean {
		return this.consumeField(state, regex, (match) => {
			const value = match[1]?.trim().toLowerCase();
			if (value === "keep" || value === "delete") {
				state.parsed.onCompletion = value;
			}
		});
	}

	private static consumeTaskPluginIdField(state: ParsingState, regex: RegExp): boolean {
		return this.consumeField(state, regex, (match) => {
			state.parsed.taskPluginId = match[1]?.trim();
		});
	}

	private static consumeDependsOnField(state: ParsingState, regex: RegExp): boolean {
		return this.consumeField(state, regex, (match) => {
			const dependsOn = this.parseTaskIdList(match[1]);
			if (dependsOn.length > 0) {
				state.parsed.dependsOn = dependsOn;
			}
		});
	}

	private static consumeDataviewField(state: ParsingState): boolean {
		const match = state.line.match(this.DATAVIEW_FIELD_AT_END_PATTERN);
		if (!match) {
			return false;
		}

		const [, opening, rawKey, rawValue, closing] = match;
		if ((opening === "[" && closing !== "]") || (opening === "(" && closing !== ")")) {
			return false;
		}

		this.applyDataviewField(state, rawKey, rawValue.trim());
		state.line = state.line.replace(this.DATAVIEW_FIELD_AT_END_PATTERN, "").trim();
		return true;
	}

	private static applyDataviewField(state: ParsingState, key: string, value: string): void {
		const normalizedKey = key.trim().toLowerCase();

		switch (normalizedKey) {
			case "priority":
				state.parsed.priority = this.normalizePriority(value);
				return;
			case "start":
				this.assignDateField(state, "startDate", value);
				return;
			case "created":
				this.assignDateField(state, "createdDate", value);
				return;
			case "scheduled":
				this.assignDateField(state, "scheduledDate", value);
				return;
			case "due":
				this.assignDateField(state, "dueDate", value);
				return;
			case "completion":
			case "done":
				this.assignDateField(state, "doneDate", value);
				return;
			case "repeat":
				Object.assign(state.parsed, this.parseRecurrence(value));
				return;
			case "oncompletion":
				if (value.toLowerCase() === "keep" || value.toLowerCase() === "delete") {
					state.parsed.onCompletion = value.toLowerCase() as "keep" | "delete";
				}
				return;
			case "id":
				state.parsed.taskPluginId = value;
				return;
			case "dependson": {
				const dependsOn = this.parseTaskIdList(value);
				if (dependsOn.length > 0) {
					state.parsed.dependsOn = dependsOn;
				}
				return;
			}
			case "summary":
			case "description":
			case "details":
				this.appendDetails(state, value);
				return;
			default:
				this.assignCustomFrontmatter(state, key, value);
		}
	}

	private static assignDateField(
		state: ParsingState,
		field: "dueDate" | "scheduledDate" | "startDate" | "createdDate" | "doneDate",
		value: string
	): void {
		const date = this.normalizeDate(value);
		if (date) {
			state.parsed[field] = date;
		}
	}

	private static consumeField(
		state: ParsingState,
		regex: RegExp,
		onMatch: (match: RegExpMatchArray) => void
	): boolean {
		const match = state.line.match(regex);
		if (!match) {
			return false;
		}

		onMatch(match);
		state.line = state.line.replace(regex, "").trim();
		return true;
	}

	private static parseTaskIdList(value: string): string[] {
		return value
			.split(",")
			.map((item) => item.trim())
			.filter((item) => /^[A-Za-z0-9_-]+$/.test(item));
	}

	private static assignCustomFrontmatter(state: ParsingState, key: string, value: string): void {
		if (!key.trim()) {
			return;
		}

		const customFrontmatter = state.parsed.customFrontmatter || {};
		const existing = customFrontmatter[key];
		if (existing === undefined) {
			customFrontmatter[key] = value;
		} else if (Array.isArray(existing)) {
			customFrontmatter[key] = [...existing, value];
		} else {
			customFrontmatter[key] = [existing, value];
		}
		state.parsed.customFrontmatter = customFrontmatter;
	}

	private static appendDetails(state: ParsingState, value: string): void {
		if (!value.trim()) {
			return;
		}

		state.parsed.details = state.parsed.details
			? `${state.parsed.details}\n\n${value.trim()}`
			: value.trim();
	}

	private static normalizeDate(dateString: string | undefined): string | undefined {
		if (!dateString) {
			return undefined;
		}

		const trimmed = dateString.trim();
		if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
			return undefined;
		}

		try {
			const date = parseDateToUTC(trimmed);
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

	private static normalizePriority(value: string | undefined): string | undefined {
		if (!value) {
			return undefined;
		}

		const normalized = value.trim().toLowerCase();
		return PRIORITY_ALIASES[normalized] || normalized || undefined;
	}

	private static parseRecurrence(recurrenceText: string | undefined): RecurrenceParseResult {
		const raw = recurrenceText?.trim();
		if (!raw) {
			return {};
		}

		const whenDoneMatch = raw.match(/\s+when\s+done$/iu);
		const recurrenceAnchor: RecurrenceAnchor | undefined = whenDoneMatch
			? "completion"
			: undefined;
		const text = raw.replace(/\s+when\s+done$/iu, "").trim();
		const existingRule = this.normalizeExistingRRule(text);
		const recurrence = existingRule || this.parseTextToRRule(text) || this.parseSimpleRecurrence(text);

		if (!recurrence) {
			return {
				recurrenceData: {
					frequency: "custom",
					raw,
				},
			};
		}

		return {
			recurrence,
			recurrenceAnchor,
			recurrenceData: this.buildRecurrenceData(recurrence, raw),
		};
	}

	private static normalizeExistingRRule(text: string): string | undefined {
		const normalized = text.trim().replace(/^RRULE:/iu, "");
		if (/^(DTSTART:[^;]+;)?FREQ=/iu.test(normalized)) {
			return normalized.toUpperCase();
		}
		return undefined;
	}

	private static parseTextToRRule(text: string): string | undefined {
		try {
			const options = RRule.parseText(text);
			if (!options) {
				return undefined;
			}
			return new RRule(options).toString().replace(/^RRULE:/u, "");
		} catch {
			return undefined;
		}
	}

	private static parseSimpleRecurrence(text: string): string | undefined {
		const normalized = text.trim().toLowerCase();
		const intervalMatch = normalized.match(/^every\s+(\d+)\s+(day|week|month|year)s?$/u);
		if (intervalMatch) {
			return `FREQ=${this.frequencyFromText(intervalMatch[2])};INTERVAL=${intervalMatch[1]}`;
		}

		const weekdayMatch = normalized.match(
			/^every\s+((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*(?:,|and)\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))*)$/u
		);
		if (weekdayMatch) {
			const days = weekdayMatch[1]
				.split(/\s*(?:,|and)\s*/u)
				.map((day) => DAY_CODES[day])
				.filter(Boolean);
			if (days.length > 0) {
				return `FREQ=WEEKLY;BYDAY=${days.join(",")}`;
			}
		}

		const weeklyOnDayMatch = normalized.match(
			/^every\s+week\s+on\s+((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*(?:,|and)\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))*)$/u
		);
		if (weeklyOnDayMatch) {
			const days = weeklyOnDayMatch[1]
				.split(/\s*(?:,|and)\s*/u)
				.map((day) => DAY_CODES[day])
				.filter(Boolean);
			if (days.length > 0) {
				return `FREQ=WEEKLY;BYDAY=${days.join(",")}`;
			}
		}

		switch (normalized) {
			case "daily":
			case "every day":
				return "FREQ=DAILY";
			case "weekly":
			case "every week":
				return "FREQ=WEEKLY";
			case "monthly":
			case "every month":
				return "FREQ=MONTHLY";
			case "yearly":
			case "annually":
			case "every year":
				return "FREQ=YEARLY";
			default:
				return undefined;
		}
	}

	private static frequencyFromText(text: string): string {
		switch (text) {
			case "day":
				return "DAILY";
			case "week":
				return "WEEKLY";
			case "month":
				return "MONTHLY";
			case "year":
				return "YEARLY";
			default:
				return "DAILY";
		}
	}

	private static buildRecurrenceData(
		recurrence: string,
		raw: string
	): ParsedTaskData["recurrenceData"] {
		const freqMatch = recurrence.match(/(?:^|;)FREQ=([^;]+)/u);
		const byDayMatch = recurrence.match(/(?:^|;)BYDAY=([^;]+)/u);
		const byMonthDayMatch = recurrence.match(/(?:^|;)BYMONTHDAY=(\d+)/u);
		const byMonthMatch = recurrence.match(/(?:^|;)BYMONTH=(\d+)/u);

		return {
			frequency: freqMatch?.[1]?.toLowerCase() || "custom",
			days_of_week: byDayMatch?.[1]?.split(","),
			day_of_month: byMonthDayMatch ? Number(byMonthDayMatch[1]) : undefined,
			month_of_year: byMonthMatch ? Number(byMonthMatch[1]) : undefined,
			raw,
		};
	}

	private static extractTags(content: string): string[] {
		if (typeof content !== "string") {
			return [];
		}

		try {
			const freshPattern = new RegExp(this.TAG_PATTERN.source, this.TAG_PATTERN.flags);
			const tags: string[] = [];
			let match;

			while ((match = freshPattern.exec(content)) !== null) {
				if (match[0]) {
					const tag = match[0].substring(1);
					if (tag && !tags.includes(tag)) {
						tags.push(tag);
					}
				}
			}

			return tags;
		} catch (error) {
			tasknotesLogger.debug("Error extracting tags:", {
				category: "validation",
				operation: "extracting-tags",
				error: error,
			});
			return [];
		}
	}

	private static extractContexts(content: string): string[] {
		if (typeof content !== "string") {
			return [];
		}

		try {
			const freshPattern = new RegExp(
				this.CONTEXT_PATTERN.source,
				this.CONTEXT_PATTERN.flags
			);
			const contexts: string[] = [];
			let match;

			while ((match = freshPattern.exec(content)) !== null) {
				if (match[0]) {
					const context = match[0].substring(1);
					if (context && !contexts.includes(context)) {
						contexts.push(context);
					}
				}
			}

			return contexts;
		} catch (error) {
			tasknotesLogger.debug("Error extracting contexts:", {
				category: "validation",
				operation: "extracting-contexts",
				error: error,
			});
			return [];
		}
	}

	private static extractCleanTitle(content: string): string {
		if (typeof content !== "string") {
			return "";
		}

		try {
			let cleanContent = content;
			cleanContent = cleanContent.replace(this.TAG_PATTERN, "");
			cleanContent = cleanContent.replace(this.CONTEXT_PATTERN, "");
			cleanContent = cleanContent.replace(this.DATAVIEW_FIELD_ANY_PATTERN, "");

			const cleaned = cleanContent.replace(/\s+/g, " ").trim();
			return cleaned.length === 0 ? "Untitled Task" : cleaned;
		} catch (error) {
			tasknotesLogger.debug("Error extracting clean title:", {
				category: "validation",
				operation: "extracting-clean-title",
				error: error,
			});
			return "Untitled Task";
		}
	}

	/**
	 * Validate if a line contains Tasks plugin metadata.
	 */
	static isTasksPluginFormat(line: string): boolean {
		if (typeof line !== "string" || line.length > 1000) {
			return false;
		}

		try {
			const trimmedLine = this.stripBlockquoteMarkers(line);
			const checkboxMatch = trimmedLine.match(this.CHECKBOX_PATTERN);
			if (!checkboxMatch) return false;

			const taskContent = checkboxMatch[4] || "";
			return this.hasTasksPluginMetadata(taskContent);
		} catch (error) {
			tasknotesLogger.debug("Error validating Tasks plugin format:", {
				category: "validation",
				operation: "validating-tasks-plugin-format",
				error: error,
			});
			return false;
		}
	}

	private static hasTasksPluginMetadata(content: string): boolean {
		return (
			/(?:📅|📆|🗓|⏳|⌛|🛫|➕|✅|🔺|⏫|🔼|🔽|⏬|🔁|🏁|🆔|⛔)/u.test(content) ||
			this.DATAVIEW_FIELD_ANY_PATTERN.test(content)
		);
	}

	/**
	 * Get a human-readable summary of parsed data for debugging.
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
