import { format, isValid } from "date-fns";
import { StatusConfig, PriorityConfig } from "../types";
import * as chrono from "chrono-node";
import { RRule } from "rrule";
import { getLanguageConfig, NLPLanguageConfig } from "../locales";

export interface ParsedTaskData {
	title: string;
	details?: string;
	dueDate?: string;
	scheduledDate?: string;
	dueTime?: string;
	scheduledTime?: string;
	priority?: string;
	status?: string;
	tags: string[];
	contexts: string[];
	projects: string[];
	recurrence?: string;
	estimate?: number; // in minutes
	isCompleted?: boolean;
}

interface RegexPattern {
	regex: RegExp;
	value: string;
}

/**
 * Pipeline processor for modular parsing stages
 */
interface ParseProcessor {
	name: string;
	process(text: string, result: ParsedTaskData): string;
}

/**
 * Service for parsing natural language input into structured task data.
 * This refined version centralizes date parsing, pre-compiles regexes for performance,
 * and uses a more declarative pattern-matching approach for maintainability.
 */
interface BoundaryConfig {
	boundary: string;
	endBoundary: string;
	isNonAscii: boolean;
}

export class NaturalLanguageParser {
	private readonly statusPatterns: RegexPattern[];
	private readonly priorityPatterns: RegexPattern[];
	private readonly recurrencePatterns: Array<{
		regex: RegExp;
		handler: (match: RegExpMatchArray) => string;
	}>;
	private readonly statusConfigs: StatusConfig[];
	private readonly defaultToScheduled: boolean;
	private readonly languageConfig: NLPLanguageConfig;
	private readonly processingPipeline: ParseProcessor[];
	private readonly boundaries: BoundaryConfig;

	constructor(
		statusConfigs: StatusConfig[] = [],
		priorityConfigs: PriorityConfig[] = [],
		defaultToScheduled = true,
		languageCode = "en"
	) {
		this.defaultToScheduled = defaultToScheduled;
		this.languageConfig = getLanguageConfig(languageCode);

		// Store status configs for string-based matching
		this.statusConfigs = statusConfigs;

		// Create boundary configuration once for all pattern building
		this.boundaries = this.createBoundaryConfig();

		// Pre-compile regex patterns for performance
		this.priorityPatterns = this.buildPriorityPatterns(priorityConfigs);
		this.statusPatterns = this.buildFallbackStatusPatterns();
		this.recurrencePatterns = this.buildRecurrencePatterns();

		// Initialize the processing pipeline
		this.processingPipeline = this.buildProcessingPipeline();
	}

	/**
	 * Creates boundary configuration based on language characteristics.
	 * Non-ASCII languages (with accented characters, non-Latin scripts) need flexible boundaries.
	 */
	private createBoundaryConfig(): BoundaryConfig {
		const isNonAscii = ["ru", "zh", "ja", "uk", "fr"].includes(this.languageConfig.code);
		return {
			boundary: isNonAscii ? "(?:^|\\s)" : "\\b",
			endBoundary: isNonAscii ? "(?=\\s|$)" : "\\b",
			isNonAscii,
		};
	}

	/**
	 * Get the appropriate chrono parser for the configured language.
	 */
	private getChronoParser(): any {
		const locale = this.languageConfig.chronoLocale;
		return (chrono as any)[locale] || chrono;
	}

	/**
	 * Build the modular processing pipeline.
	 * Each processor is self-contained and operates on the current state.
	 */
	private buildProcessingPipeline(): ParseProcessor[] {
		return [
			{
				name: "extractTags",
				process: (text: string, result: ParsedTaskData) => this.extractTags(text, result),
			},
			{
				name: "extractContexts",
				process: (text: string, result: ParsedTaskData) =>
					this.extractContexts(text, result),
			},
			{
				name: "extractProjects",
				process: (text: string, result: ParsedTaskData) =>
					this.extractProjects(text, result),
			},
			{
				name: "extractPriority",
				process: (text: string, result: ParsedTaskData) =>
					this.extractPriority(text, result),
			},
			{
				name: "extractStatus",
				process: (text: string, result: ParsedTaskData) => this.extractStatus(text, result),
			},
			{
				name: "extractRecurrence",
				process: (text: string, result: ParsedTaskData) =>
					this.extractRecurrence(text, result),
			},
			{
				name: "extractTimeEstimate",
				process: (text: string, result: ParsedTaskData) =>
					this.extractTimeEstimate(text, result),
			},
			{
				name: "parseUnifiedDatesAndTimes",
				process: (text: string, result: ParsedTaskData) =>
					this.parseUnifiedDatesAndTimes(text, result),
			},
		];
	}

	/**
	 * Parse natural language input into structured task data using a modular pipeline architecture.
	 * Each processing stage is self-contained and can be easily reordered, added, or removed.
	 */
	public parseInput(input: string): ParsedTaskData {
		const result: ParsedTaskData = {
			title: "",
			tags: [],
			contexts: [],
			projects: [],
		};

		// 1. Separate title line from details
		const [workingText, details] = this.extractTitleAndDetails(input);
		if (details) {
			result.details = details;
		}

		// 2. Run through the processing pipeline
		let remainingText = workingText;

		for (const processor of this.processingPipeline) {
			try {
				remainingText = processor.process(remainingText, result);
			} catch (error) {
				console.debug(`Error in processor ${processor.name}:`, error);
				// Continue with other processors even if one fails
			}
		}

		// 3. The remainder is the title
		result.title = remainingText.trim();

		// 4. Validate and finalize the result
		return this.validateAndCleanupResult(result);
	}

	/**
	 * Splits the input string into the first line (for parsing) and the rest (for details).
	 */
	private extractTitleAndDetails(input: string): [string, string | undefined] {
		const trimmedInput = input.trim();
		const firstLineBreak = trimmedInput.indexOf("\n");

		if (firstLineBreak !== -1) {
			const titleLine = trimmedInput.substring(0, firstLineBreak).trim();
			const details = trimmedInput.substring(firstLineBreak + 1).trim();
			return [titleLine, details];
		}

		return [trimmedInput, undefined];
	}

	/** Extracts #tags from the text and adds them to the result object. */
	private extractTags(text: string, result: ParsedTaskData): string {
		const tagMatches = text.match(/#[\w/-]+/g);
		if (tagMatches) {
			result.tags.push(...tagMatches.map((tag) => tag.substring(1)));
			return this.cleanupWhitespace(text.replace(/#[\w/-]+/g, ""));
		}
		return text;
	}

	/** Extracts @contexts from the text and adds them to the result object. */
	private extractContexts(text: string, result: ParsedTaskData): string {
		const contextMatches = text.match(/@\w+/g);
		if (contextMatches) {
			result.contexts.push(...contextMatches.map((context) => context.substring(1)));
			return this.cleanupWhitespace(text.replace(/@\w+/g, ""));
		}
		return text;
	}

	/** Extracts +projects and +[[wikilinks]] from the text and adds them to the result object. */
	private extractProjects(text: string, result: ParsedTaskData): string {
		let workingText = text;

		// Extract +[[wikilink]] patterns first (more specific)
		const wikilinkProjectMatches = workingText.match(/\+\[\[.*?\]\]/g);
		if (wikilinkProjectMatches) {
			result.projects.push(
				...wikilinkProjectMatches.map((project) => {
					// Remove the + prefix but keep [[ ]]
					let projectName = project.slice(1); // Remove just the +
					// Keep the full wikilink as-is for now - resolution will happen in InstantTaskConvertService
					return projectName;
				})
			);
			workingText = this.cleanupWhitespace(workingText.replace(/\+\[\[.*?\]\]/g, ""));
		}

		// Extract +project patterns (simple word projects)
		const projectMatches = workingText.match(/\+[\w/-]+/g);
		if (projectMatches) {
			result.projects.push(...projectMatches.map((project) => project.substring(1)));
			workingText = this.cleanupWhitespace(workingText.replace(/\+[\w/-]+/g, ""));
		}

		return workingText;
	}

	/**
	 * Pre-builds priority regex patterns from configuration for efficiency.
	 * Creates patterns for both custom priority configs and language fallbacks.
	 *
	 * @param configs Custom priority configurations
	 * @returns Array of compiled regex patterns with their corresponding priority values
	 */
	private buildPriorityPatterns(configs: PriorityConfig[]): RegexPattern[] {
		if (configs.length > 0) {
			return configs.flatMap((config) => [
				{
					regex: new RegExp(`\\b${this.escapeRegex(config.value)}\\b`, "i"),
					value: config.value,
				},
				{
					regex: new RegExp(`\\b${this.escapeRegex(config.label)}\\b`, "i"),
					value: config.value,
				},
			]);
		}
		// Fallback patterns from language config - order matters, most specific first
		const patterns: RegexPattern[] = [];
		const langConfig = this.languageConfig.fallbackPriority;

		// Build regex patterns from language config with proper escaping and boundary handling
		const { boundary, endBoundary } = this.boundaries;

		patterns.push({
			regex: new RegExp(
				`${boundary}(${langConfig.urgent.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`,
				"i"
			),
			value: "urgent",
		});
		patterns.push({
			regex: new RegExp(
				`${boundary}(${langConfig.high.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`,
				"i"
			),
			value: "high",
		});
		patterns.push({
			regex: new RegExp(
				`${boundary}(${langConfig.normal.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`,
				"i"
			),
			value: "normal",
		});
		patterns.push({
			regex: new RegExp(
				`${boundary}(${langConfig.low.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`,
				"i"
			),
			value: "low",
		});

		return patterns;
	}

	/** Extracts priority using pre-compiled patterns. */
	private extractPriority(text: string, result: ParsedTaskData): string {
		let foundMatch: { pattern: RegexPattern; index: number } | null = null;

		// Find the first occurrence in the text
		for (const pattern of this.priorityPatterns) {
			const match = text.match(pattern.regex);
			if (match && match.index !== undefined) {
				if (!foundMatch || match.index < foundMatch.index) {
					foundMatch = { pattern, index: match.index };
				}
			}
		}

		if (foundMatch) {
			result.priority = foundMatch.pattern.value;
			return this.cleanupWhitespace(text.replace(foundMatch.pattern.regex, ""));
		}

		return text;
	}

	/**
	 * Pre-builds fallback status regex patterns using language config.
	 * Uses appropriate word boundaries for different language types (ASCII vs non-ASCII).
	 *
	 * Pattern examples:
	 * - English: \b(done|completed|finished)\b
	 * - French: (?:^|\s)(terminé|fini|accompli)(?=\s|$)
	 *
	 * @returns Array of compiled status regex patterns
	 */
	private buildFallbackStatusPatterns(): RegexPattern[] {
		const langConfig = this.languageConfig.fallbackStatus;

		// Use pre-configured boundary matching
		const { boundary, endBoundary } = this.boundaries;

		return [
			{
				regex: new RegExp(
					`${boundary}(${langConfig.open.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`,
					"i"
				),
				value: "open",
			},
			{
				regex: new RegExp(
					`${boundary}(${langConfig.inProgress.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`,
					"i"
				),
				value: "in-progress",
			},
			{
				regex: new RegExp(
					`${boundary}(${langConfig.done.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`,
					"i"
				),
				value: "done",
			},
			{
				regex: new RegExp(
					`${boundary}(${langConfig.cancelled.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`,
					"i"
				),
				value: "cancelled",
			},
			{
				regex: new RegExp(
					`${boundary}(${langConfig.waiting.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`,
					"i"
				),
				value: "waiting",
			},
		];
	}

	/** Extracts status using string-based matching for custom statuses and regex for fallbacks. */
	private extractStatus(text: string, result: ParsedTaskData): string {
		// First try string-based matching for custom status configs (handles any characters)
		if (this.statusConfigs.length > 0) {
			// Sort by length (longest first) to prevent partial matches
			const sortedConfigs = [...this.statusConfigs].sort(
				(a, b) => b.label.length - a.label.length
			);

			for (const config of sortedConfigs) {
				// Try both label and value
				const candidates = [config.label, config.value];

				for (const candidate of candidates) {
					// Skip empty candidates
					if (!candidate || candidate.trim() === "") {
						continue;
					}
					const match = this.findStatusMatch(text, candidate);
					if (match) {
						result.status = config.value;
						return this.cleanupWhitespace(text.replace(match.fullMatch, ""));
					}
				}
			}
		}

		// Fallback to regex patterns for built-in status keywords
		for (const pattern of this.statusPatterns) {
			if (pattern.regex.test(text)) {
				result.status = pattern.value;
				return this.cleanupWhitespace(text.replace(pattern.regex, ""));
			}
		}

		return text;
	}

	/**
	 * Finds a status match using case-insensitive string search with boundary checking.
	 * Returns the match details or null if no valid match found.
	 */
	private findStatusMatch(
		text: string,
		statusText: string
	): { fullMatch: string; startIndex: number } | null {
		// Guard against empty status text to prevent infinite loop
		if (!statusText || statusText.trim() === "") {
			return null;
		}

		const lowerText = text.toLowerCase();
		const lowerStatus = statusText.toLowerCase();

		let searchIndex = 0;
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const index = lowerText.indexOf(lowerStatus, searchIndex);
			if (index === -1) break;

			// Check if this is a valid word boundary match
			const beforeChar = index > 0 ? text[index - 1] : " ";
			const afterIndex = index + statusText.length;
			const afterChar = afterIndex < text.length ? text[afterIndex] : " ";

			// Valid if surrounded by whitespace or string boundaries
			const isValidBefore = /\s/.test(beforeChar) || index === 0;
			const isValidAfter = /\s/.test(afterChar) || afterIndex === text.length;

			if (isValidBefore && isValidAfter) {
				return {
					fullMatch: text.substring(index, afterIndex),
					startIndex: index,
				};
			}

			searchIndex = index + 1;
		}

		return null;
	}

	/**
	 * Unified method to parse all dates and times with internationalized context awareness.
	 * Combines the functionality of extractExplicitDates and parseDatesAndTimes.
	 *
	 * Processing order:
	 * 1. Look for explicit trigger patterns: "due tomorrow", "scheduled for friday"
	 * 2. Parse implicit dates using chrono-node with language-specific parser
	 * 3. Determine if date is due/scheduled based on context and defaultToScheduled setting
	 *
	 * Trigger pattern examples:
	 * - English: "due\s+", "scheduled\s+for"
	 * - French: "échéance\s+", "programmé\s+pour"
	 * - German: "fällig\s+am", "geplant\s+für"
	 *
	 * @param text Input text to parse
	 * @param result ParsedTaskData object to populate with date/time fields
	 * @returns Text with date/time patterns removed
	 */
	private parseUnifiedDatesAndTimes(text: string, result: ParsedTaskData): string {
		let workingText = text;

		try {
			const chronoParser = this.getChronoParser();
			const langTriggers = this.languageConfig.dateTriggers;

			// First, try to find explicit trigger patterns
			const triggerPatterns = [
				{
					type: "due",
					regex: new RegExp(
						`\\b(${langTriggers.due.map((t) => this.escapeRegex(t)).join("|")})`,
						"i"
					),
				},
				{
					type: "scheduled",
					regex: new RegExp(
						`\\b(${langTriggers.scheduled.map((t) => this.escapeRegex(t)).join("|")})`,
						"i"
					),
				},
			];

			// Check for explicit triggers first
			for (const triggerPattern of triggerPatterns) {
				const match = workingText.match(triggerPattern.regex);
				if (match) {
					// Get the position where the date text starts (after the trigger)
					const triggerEnd = (match.index || 0) + match[0].length;
					const remainingText = workingText.substring(triggerEnd);

					// Use chrono-node to parse from this position onward
					const chronoParsed = this.parseChronoFromPosition(remainingText);

					if (chronoParsed.success) {
						// Assign to the correct field based on trigger type
						if (triggerPattern.type === "due") {
							result.dueDate = chronoParsed.date;
							if (chronoParsed.time) {
								result.dueTime = chronoParsed.time;
							}
						} else {
							result.scheduledDate = chronoParsed.date;
							if (chronoParsed.time) {
								result.scheduledTime = chronoParsed.time;
							}
						}

						// Remove the entire matched expression (trigger + date) from working text
						workingText = workingText.replace(triggerPattern.regex, "");
						if (chronoParsed.matchedText) {
							workingText = workingText.replace(chronoParsed.matchedText, "");
						}
						workingText = this.cleanupWhitespace(workingText);
						return workingText; // Early return after finding explicit trigger
					}
				}
			}

			// If no explicit triggers found, parse all remaining dates with context
			const parsedResults = chronoParser.parse(text, new Date(), { forwardDate: true });
			if (parsedResults.length === 0) {
				return text;
			}

			const primaryMatch = parsedResults[0];
			const dateText = primaryMatch.text;

			const startDate = primaryMatch.start.date();
			const endDate = primaryMatch.end?.date();

			// Create internationalized patterns for context detection
			const dueKeywordPattern = new RegExp(
				`\\b(${langTriggers.due.map((t) => this.escapeRegex(t)).join("|")})\\b`,
				"i"
			);
			const scheduledKeywordPattern = new RegExp(
				`\\b(${langTriggers.scheduled.map((t) => this.escapeRegex(t)).join("|")})\\b`,
				"i"
			);

			let isDue = dueKeywordPattern.test(primaryMatch.text);
			let isScheduled = scheduledKeywordPattern.test(primaryMatch.text);

			// Handle date ranges (e.g., "from tomorrow to next friday")
			if (endDate && isValid(endDate) && endDate.getTime() !== startDate.getTime()) {
				result.scheduledDate = format(startDate, "yyyy-MM-dd");
				if (primaryMatch.start.isCertain("hour")) {
					result.scheduledTime = format(startDate, "HH:mm");
				}
				result.dueDate = format(endDate, "yyyy-MM-dd");
				if (primaryMatch.end?.isCertain("hour")) {
					result.dueTime = format(endDate, "HH:mm");
				}
			}
			// Handle single dates
			else if (isValid(startDate)) {
				const dateString = format(startDate, "yyyy-MM-dd");
				const timeString = primaryMatch.start.isCertain("hour")
					? format(startDate, "HH:mm")
					: undefined;

				// Prioritize explicit keywords, otherwise use default setting
				if (isDue && !isScheduled) {
					result.dueDate = dateString;
					result.dueTime = timeString;
				} else if (isScheduled && !isDue) {
					result.scheduledDate = dateString;
					result.scheduledTime = timeString;
				} else if (this.defaultToScheduled) {
					result.scheduledDate = dateString;
					result.scheduledTime = timeString;
				} else {
					result.dueDate = dateString;
					result.dueTime = timeString;
				}
			}

			// Remove the date text from the working text
			workingText = workingText.replace(dateText, "").trim();
			workingText = this.cleanupWhitespace(workingText);
		} catch (error) {
			console.debug("Error in unified date parsing:", error);
		}

		return workingText;
	}

	/**
	 * Use chrono-node to parse date starting from a specific position.
	 * Uses language-specific chrono parser and validates that match starts near beginning.
	 *
	 * Position validation: Match must start within first 3 characters to account for
	 * prepositions like "on", "at", "le", "am" in different languages.
	 *
	 * @param text Text to parse (typically after a trigger word)
	 * @returns Parsed date result with success flag, formatted date/time, and matched text
	 */
	private parseChronoFromPosition(text: string): {
		success: boolean;
		date?: string;
		time?: string;
		matchedText?: string;
	} {
		try {
			// Parse the text starting from the beginning using locale-specific parser
			const chronoParser = this.getChronoParser();
			const parsed = chronoParser.parse(text, new Date(), { forwardDate: true });

			if (parsed.length > 0) {
				const firstMatch = parsed[0];

				// Ensure the match starts at or near the beginning of the text
				if (firstMatch.index <= 3) {
					// Allow for a few characters of whitespace/prepositions
					const parsedDate = firstMatch.start.date();
					if (isValid(parsedDate)) {
						const result: any = {
							success: true,
							date: format(parsedDate, "yyyy-MM-dd"),
							matchedText: firstMatch.text,
						};

						// Check if time is included and certain
						if (firstMatch.start.isCertain("hour")) {
							result.time = format(parsedDate, "HH:mm");
						}

						return result;
					}
				}
			}
		} catch (error) {
			console.debug("Error parsing date with chrono:", error);
		}

		return { success: false };
	}

	/**
	 * Builds comprehensive recurrence patterns from language configuration.
	 * Patterns are ordered by priority (most specific first) and cached for performance.
	 */
	private buildRecurrencePatterns(): Array<{
		regex: RegExp;
		handler: (match: RegExpMatchArray) => string;
	}> {
		const lang = this.languageConfig.recurrence;
		const patterns = [];

		// Use pre-configured boundary matching
		const { boundary, endBoundary } = this.boundaries;

		// Helper function to escape and join patterns
		const escapeAndJoin = (patterns: string[]) =>
			patterns.map((p) => this.escapeRegex(p)).join("|");

		// Build patterns in priority order (most specific first)
		patterns.push(
			...this.buildOrdinalWeekdayPatterns(lang, boundary, endBoundary, escapeAndJoin)
		);
		patterns.push(...this.buildIntervalPatterns(lang, boundary, endBoundary, escapeAndJoin));
		patterns.push(...this.buildEveryOtherPatterns(lang, boundary, endBoundary, escapeAndJoin));
		patterns.push(...this.buildWeekdayPatterns(lang, boundary, endBoundary, escapeAndJoin));
		patterns.push(...this.buildFrequencyPatterns(lang, boundary, endBoundary, escapeAndJoin));

		return patterns;
	}

	/**
	 * Builds "every [ordinal] [weekday]" patterns (e.g., "every second monday").
	 * These have highest priority as they are most specific.
	 */
	private buildOrdinalWeekdayPatterns(
		lang: any,
		boundary: string,
		endBoundary: string,
		escapeAndJoin: (patterns: string[]) => string
	) {
		const everyKeywords = escapeAndJoin(lang.every);
		const ordinalPatterns = escapeAndJoin([
			...lang.ordinals.first,
			...lang.ordinals.second,
			...lang.ordinals.third,
			...lang.ordinals.fourth,
			...lang.ordinals.last,
		]);
		const weekdayPatterns = escapeAndJoin([
			...lang.weekdays.monday,
			...lang.weekdays.tuesday,
			...lang.weekdays.wednesday,
			...lang.weekdays.thursday,
			...lang.weekdays.friday,
			...lang.weekdays.saturday,
			...lang.weekdays.sunday,
		]);

		return [
			{
				regex: new RegExp(
					`${boundary}(${everyKeywords})\\s+(${ordinalPatterns})\\s+(${weekdayPatterns})${endBoundary}`,
					"i"
				),
				handler: (match: RegExpMatchArray) => {
					const ordinalText = match[2].toLowerCase();
					const dayText = match[3].toLowerCase();

					// Find ordinal position
					let position = 1;
					if (lang.ordinals.second.some((o: string) => o.toLowerCase() === ordinalText))
						position = 2;
					else if (
						lang.ordinals.third.some((o: string) => o.toLowerCase() === ordinalText)
					)
						position = 3;
					else if (
						lang.ordinals.fourth.some((o: string) => o.toLowerCase() === ordinalText)
					)
						position = 4;
					else if (
						lang.ordinals.last.some((o: string) => o.toLowerCase() === ordinalText)
					)
						position = -1;

					// Find weekday
					const rruleDay = this.getWeekdayRRuleCode(dayText, lang);
					return `FREQ=MONTHLY;BYDAY=${rruleDay};BYSETPOS=${position}`;
				},
			},
		];
	}

	/**
	 * Builds "every [N] [period]" patterns (e.g., "every 3 days", "every 2 weeks").
	 */
	private buildIntervalPatterns(
		lang: any,
		boundary: string,
		endBoundary: string,
		escapeAndJoin: (patterns: string[]) => string
	) {
		const everyKeywords = escapeAndJoin(lang.every);
		const periodPatterns = escapeAndJoin([
			...lang.periods.day,
			...lang.periods.week,
			...lang.periods.month,
			...lang.periods.year,
		]);

		return [
			{
				regex: new RegExp(
					`${boundary}(${everyKeywords})\\s+(\\d+)\\s+(${periodPatterns})${endBoundary}`,
					"i"
				),
				handler: (match: RegExpMatchArray) => {
					const interval = parseInt(match[2]);
					const periodText = match[3].toLowerCase();
					const freq = this.getPeriodFrequency(periodText, lang);
					return `FREQ=${freq};INTERVAL=${interval}`;
				},
			},
		];
	}

	/**
	 * Builds "every other [period]" patterns (e.g., "every other week").
	 */
	private buildEveryOtherPatterns(
		lang: any,
		boundary: string,
		endBoundary: string,
		escapeAndJoin: (patterns: string[]) => string
	) {
		const everyKeywords = escapeAndJoin(lang.every);
		const otherKeywords = escapeAndJoin(lang.other);
		const periodPatterns = escapeAndJoin([
			...lang.periods.day,
			...lang.periods.week,
			...lang.periods.month,
			...lang.periods.year,
		]);

		return [
			{
				regex: new RegExp(
					`${boundary}(${everyKeywords})\\s+(${otherKeywords})\\s+(${periodPatterns})${endBoundary}`,
					"i"
				),
				handler: (match: RegExpMatchArray) => {
					const periodText = match[3].toLowerCase();
					const freq = this.getPeriodFrequency(periodText, lang);
					return `FREQ=${freq};INTERVAL=2`;
				},
			},
		];
	}

	/**
	 * Builds weekday patterns ("every [weekday]" and plural weekdays).
	 */
	private buildWeekdayPatterns(
		lang: any,
		boundary: string,
		endBoundary: string,
		escapeAndJoin: (patterns: string[]) => string
	) {
		const everyKeywords = escapeAndJoin(lang.every);
		const weekdayPatterns = escapeAndJoin([
			...lang.weekdays.monday,
			...lang.weekdays.tuesday,
			...lang.weekdays.wednesday,
			...lang.weekdays.thursday,
			...lang.weekdays.friday,
			...lang.weekdays.saturday,
			...lang.weekdays.sunday,
		]);
		const pluralWeekdayPatterns = escapeAndJoin([
			...lang.pluralWeekdays.monday,
			...lang.pluralWeekdays.tuesday,
			...lang.pluralWeekdays.wednesday,
			...lang.pluralWeekdays.thursday,
			...lang.pluralWeekdays.friday,
			...lang.pluralWeekdays.saturday,
			...lang.pluralWeekdays.sunday,
		]);

		return [
			// "every [weekday]" patterns
			{
				regex: new RegExp(
					`${boundary}(${everyKeywords})\\s+(${weekdayPatterns})${endBoundary}`,
					"i"
				),
				handler: (match: RegExpMatchArray) => {
					const dayText = match[2].toLowerCase();
					const rruleDay = this.getWeekdayRRuleCode(dayText, lang);
					return `FREQ=WEEKLY;BYDAY=${rruleDay}`;
				},
			},
			// Plural weekdays ("mondays", "tuesdays")
			{
				regex: new RegExp(`${boundary}(${pluralWeekdayPatterns})${endBoundary}`, "i"),
				handler: (match: RegExpMatchArray) => {
					const dayText = match[1].toLowerCase();
					const rruleDay = this.getPluralWeekdayRRuleCode(dayText, lang);
					return `FREQ=WEEKLY;BYDAY=${rruleDay}`;
				},
			},
		];
	}

	/**
	 * Builds general frequency patterns (daily, weekly, monthly, yearly).
	 */
	private buildFrequencyPatterns(
		lang: any,
		boundary: string,
		endBoundary: string,
		escapeAndJoin: (patterns: string[]) => string
	) {
		return [
			{
				regex: new RegExp(
					`${boundary}(${escapeAndJoin(lang.frequencies.daily)})${endBoundary}`,
					"i"
				),
				handler: () => "FREQ=DAILY",
			},
			{
				regex: new RegExp(
					`${boundary}(${escapeAndJoin(lang.frequencies.weekly)})${endBoundary}`,
					"i"
				),
				handler: () => "FREQ=WEEKLY",
			},
			{
				regex: new RegExp(
					`${boundary}(${escapeAndJoin(lang.frequencies.monthly)})${endBoundary}`,
					"i"
				),
				handler: () => "FREQ=MONTHLY",
			},
			{
				regex: new RegExp(
					`${boundary}(${escapeAndJoin(lang.frequencies.yearly)})${endBoundary}`,
					"i"
				),
				handler: () => "FREQ=YEARLY",
			},
		];
	}

	/**
	 * Helper to determine frequency type from period text.
	 */
	private getPeriodFrequency(periodText: string, lang: any): string {
		if (lang.periods.week.some((p: string) => p.toLowerCase() === periodText)) return "WEEKLY";
		if (lang.periods.month.some((p: string) => p.toLowerCase() === periodText))
			return "MONTHLY";
		if (lang.periods.year.some((p: string) => p.toLowerCase() === periodText)) return "YEARLY";
		return "DAILY"; // default
	}

	/**
	 * Helper to get RRule weekday code from weekday text.
	 */
	private getWeekdayRRuleCode(dayText: string, lang: any): string {
		if (lang.weekdays.tuesday.some((d: string) => d.toLowerCase() === dayText)) return "TU";
		if (lang.weekdays.wednesday.some((d: string) => d.toLowerCase() === dayText)) return "WE";
		if (lang.weekdays.thursday.some((d: string) => d.toLowerCase() === dayText)) return "TH";
		if (lang.weekdays.friday.some((d: string) => d.toLowerCase() === dayText)) return "FR";
		if (lang.weekdays.saturday.some((d: string) => d.toLowerCase() === dayText)) return "SA";
		if (lang.weekdays.sunday.some((d: string) => d.toLowerCase() === dayText)) return "SU";
		return "MO"; // default to Monday
	}

	/**
	 * Helper to get RRule weekday code from plural weekday text.
	 */
	private getPluralWeekdayRRuleCode(dayText: string, lang: any): string {
		if (lang.pluralWeekdays.tuesday.some((d: string) => d.toLowerCase() === dayText))
			return "TU";
		if (lang.pluralWeekdays.wednesday.some((d: string) => d.toLowerCase() === dayText))
			return "WE";
		if (lang.pluralWeekdays.thursday.some((d: string) => d.toLowerCase() === dayText))
			return "TH";
		if (lang.pluralWeekdays.friday.some((d: string) => d.toLowerCase() === dayText))
			return "FR";
		if (lang.pluralWeekdays.saturday.some((d: string) => d.toLowerCase() === dayText))
			return "SA";
		if (lang.pluralWeekdays.sunday.some((d: string) => d.toLowerCase() === dayText))
			return "SU";
		return "MO"; // default to Monday
	}

	/**
	 * Extracts recurrence from text and generates rrule strings using cached language-aware patterns.
	 * All patterns are internationalized and sourced from language configurations.
	 */
	private extractRecurrence(text: string, result: ParsedTaskData): string {
		for (const pattern of this.recurrencePatterns) {
			const match = text.match(pattern.regex);
			if (match) {
				const rruleString = pattern.handler(match);
				// Validate the rrule string before setting it
				if (this.isValidRRuleString(rruleString)) {
					result.recurrence = rruleString;
					return this.cleanupWhitespace(text.replace(pattern.regex, ""));
				}
			}
		}

		return text;
	}

	/**
	 * Validate an rrule string to prevent parsing errors
	 */
	private isValidRRuleString(rruleString: string): boolean {
		// Check for empty or undefined BYDAY values
		if (
			rruleString.includes("BYDAY=undefined") ||
			rruleString.includes("BYDAY=;") ||
			rruleString.includes("BYDAY=")
		) {
			const byDayMatch = rruleString.match(/BYDAY=([^;]*)/);
			if (
				byDayMatch &&
				(!byDayMatch[1] || byDayMatch[1] === "undefined" || byDayMatch[1].trim() === "")
			) {
				return false;
			}
		}

		// Check for basic FREQ requirement
		if (!rruleString.includes("FREQ=")) {
			return false;
		}

		return true;
	}

	/**
	 * Extracts time estimate from text using language-aware patterns.
	 * Supports combined formats (1h30m), hours only (2hrs), and minutes only (45min).
	 *
	 * Pattern examples:
	 * - Combined: "2h 30m" → 150 minutes
	 * - Hours: "3 hours" → 180 minutes
	 * - Minutes: "45 minutes" → 45 minutes
	 *
	 * @param text Input text to parse
	 * @param result ParsedTaskData object to populate
	 * @returns Text with time estimate patterns removed
	 */
	private extractTimeEstimate(text: string, result: ParsedTaskData): string {
		const langConfig = this.languageConfig.timeEstimate;

		// Use pre-configured boundary matching
		const { boundary, endBoundary } = this.boundaries;

		const patterns = [
			// Combined format: 1h30m
			{
				regex: new RegExp(
					`${boundary}(\\d+)(${langConfig.hours.map((p) => this.escapeRegex(p)).join("|")})\\s*(\\d+)(${langConfig.minutes.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`,
					"i"
				),
				handler: (m: RegExpMatchArray) => parseInt(m[1]) * 60 + parseInt(m[3]),
			},
			// Hours: 1hr, 2 hours, 3h
			{
				regex: new RegExp(
					`${boundary}(\\d+)\\s*(${langConfig.hours.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`,
					"i"
				),
				handler: (m: RegExpMatchArray) => parseInt(m[1]) * 60,
			},
			// Minutes: 30min, 45 m, 15 minutes
			{
				regex: new RegExp(
					`${boundary}(\\d+)\\s*(${langConfig.minutes.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`,
					"i"
				),
				handler: (m: RegExpMatchArray) => parseInt(m[1]),
			},
		];

		let workingText = text;
		let totalEstimate = 0;

		for (const pattern of patterns) {
			const match = workingText.match(pattern.regex);
			if (match) {
				totalEstimate += pattern.handler(match);
				workingText = this.cleanupWhitespace(workingText.replace(pattern.regex, ""));
			}
		}

		if (totalEstimate > 0) {
			result.estimate = totalEstimate;
		}

		return workingText;
	}

	/**
	 * Ensures the final parsed data is valid and clean.
	 */
	private validateAndCleanupResult(result: ParsedTaskData): ParsedTaskData {
		// If title becomes empty after parsing, use a default
		if (!result.title.trim()) {
			result.title = "Untitled Task";
		}

		// Sanitize and remove duplicates from arrays
		result.tags = [...new Set(result.tags.filter(Boolean))];
		result.contexts = [...new Set(result.contexts.filter(Boolean))];
		result.projects = [...new Set(result.projects.filter(Boolean))];

		// Ensure date and time strings are valid formats (defensive check)
		if (result.dueDate && !this.isValidDateString(result.dueDate)) delete result.dueDate;
		if (result.scheduledDate && !this.isValidDateString(result.scheduledDate))
			delete result.scheduledDate;
		if (result.dueTime && !this.isValidTimeString(result.dueTime)) delete result.dueTime;
		if (result.scheduledTime && !this.isValidTimeString(result.scheduledTime))
			delete result.scheduledTime;

		return result;
	}

	private isValidDateString = (dateString: string): boolean =>
		/^\d{4}-\d{2}-\d{2}$/.test(dateString);
	private isValidTimeString = (timeString: string): boolean =>
		/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeString);
	private escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

	/** Cleans up whitespace after text extraction */
	private cleanupWhitespace = (text: string): string => {
		return text
			.replace(/\s+/g, " ")
			.replace(/^\s+|\s+$/g, "")
			.trim();
	};

	/**
	 * Generates a user-friendly preview of the parsed data.
	 * Icons are placeholders for the UI layer to interpret.
	 */
	public getPreviewData(parsed: ParsedTaskData): Array<{ icon: string; text: string }> {
		const parts: Array<{ icon: string; text: string }> = [];

		if (parsed.title) parts.push({ icon: "edit-3", text: `"${parsed.title}"` });
		if (parsed.details)
			parts.push({
				icon: "file-text",
				text: `Details: "${parsed.details.substring(0, 50)}${parsed.details.length > 50 ? "..." : ""}"`,
			});
		if (parsed.dueDate) {
			const dateStr = parsed.dueTime
				? `${parsed.dueDate} at ${parsed.dueTime}`
				: parsed.dueDate;
			parts.push({ icon: "calendar", text: `Due: ${dateStr}` });
		}
		if (parsed.scheduledDate) {
			const dateStr = parsed.scheduledTime
				? `${parsed.scheduledDate} at ${parsed.scheduledTime}`
				: parsed.scheduledDate;
			parts.push({ icon: "calendar-clock", text: `Scheduled: ${dateStr}` });
		}
		if (parsed.priority)
			parts.push({ icon: "alert-triangle", text: `Priority: ${parsed.priority}` });
		if (parsed.status) parts.push({ icon: "activity", text: `Status: ${parsed.status}` });
		if (parsed.contexts && parsed.contexts.length > 0)
			parts.push({
				icon: "map-pin",
				text: `Contexts: ${parsed.contexts.map((c) => "@" + c).join(", ")}`,
			});
		if (parsed.projects && parsed.projects.length > 0) {
			// Display projects with + prefix and determine if they should have wikilink format
			const projectDisplay = parsed.projects
				.map((p) => {
					// If the project name contains spaces or special characters, use wikilink format
					if (p.includes(" ") || p.includes("-") || p.match(/[A-Z]/)) {
						return `+[[${p}]]`;
					} else {
						return `+${p}`;
					}
				})
				.join(", ");
			parts.push({ icon: "folder", text: `Projects: ${projectDisplay}` });
		}
		if (parsed.tags && parsed.tags.length > 0)
			parts.push({
				icon: "tag",
				text: `Tags: ${parsed.tags.map((t) => "#" + t).join(", ")}`,
			});
		if (parsed.recurrence) {
			let recurrenceText = "Invalid recurrence";
			try {
				// Ensure it's a valid RRule before trying to parse
				if (
					parsed.recurrence.includes("FREQ=") &&
					this.isValidRRuleString(parsed.recurrence)
				) {
					recurrenceText = RRule.fromString(parsed.recurrence).toText();
				}
			} catch (error) {
				console.debug("Error parsing rrule for preview:", error);
			}
			parts.push({ icon: "repeat", text: `Recurrence: ${recurrenceText}` });
		}
		if (parsed.estimate)
			parts.push({ icon: "clock", text: `Estimate: ${parsed.estimate} min` });

		return parts;
	}

	/**
	 * Generates a simple text-only preview of the parsed data.
	 */
	public getPreviewText(parsed: ParsedTaskData): string {
		return this.getPreviewData(parsed)
			.map((part) => part.text)
			.join(" • ");
	}
}
