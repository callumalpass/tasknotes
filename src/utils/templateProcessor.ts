import { format } from "date-fns";
import { parseYaml } from "obsidian";
// YAML not needed in template processor

export interface TemplateData {
	title: string;
	priority: string;
	status: string;
	contexts: string[];
	tags: string[];
	timeEstimate: number;
	dueDate: string;
	scheduledDate: string;
	details: string;
	parentNote: string;
}

export interface ICSTemplateData extends TemplateData {
	icsEventTitle: string;
	icsEventStart: string;
	icsEventEnd: string;
	icsEventLocation: string;
	icsEventDescription: string;
	icsEventUrl: string;
	icsEventSubscription: string;
	icsEventId: string;
}

export interface ProcessedTemplate {
	frontmatter: Record<string, any>;
	body: string;
}

/**
 * Process a complete template with frontmatter and body
 */
export function processTemplate(templateContent: string, taskData: TemplateData): ProcessedTemplate;
export function processTemplate(
	templateContent: string,
	taskData: ICSTemplateData
): ProcessedTemplate;
export function processTemplate(
	templateContent: string,
	taskData: TemplateData | ICSTemplateData
): ProcessedTemplate {
	const sections = parseTemplateSections(templateContent);

	const processedFrontmatter = sections.frontmatter
		? processTemplateFrontmatter(sections.frontmatter, taskData)
		: {};

	const processedBody = processTemplateBody(sections.body, taskData);

	return {
		frontmatter: processedFrontmatter,
		body: processedBody,
	};
}

/**
 * Parse template into frontmatter and body sections
 */
function parseTemplateSections(templateContent: string): {
	frontmatter: string | null;
	body: string;
} {
	const lines = templateContent.split("\n");

	// Check if template starts with frontmatter
	if (lines[0]?.trim() === "---") {
		// Find the closing ---
		let endIndex = -1;
		for (let i = 1; i < lines.length; i++) {
			if (lines[i]?.trim() === "---") {
				endIndex = i;
				break;
			}
		}

		if (endIndex > 0) {
			// Extract frontmatter content (between the --- lines)
			const frontmatterLines = lines.slice(1, endIndex);
			const frontmatter = frontmatterLines.join("\n");

			// Extract body content (after the closing ---)
			const bodyLines = lines.slice(endIndex + 1);
			const body = bodyLines.join("\n");

			return {
				frontmatter: frontmatter.trim() || null,
				body: body,
			};
		}
	}

	// No frontmatter found, entire content is body
	return {
		frontmatter: null,
		body: templateContent,
	};
}

/**
 * Process template variables in frontmatter
 */
function processTemplateFrontmatter(
	frontmatterContent: string,
	taskData: TemplateData | ICSTemplateData
): Record<string, any> {
	try {
		// First, process template variables in the raw YAML text with YAML-safe replacements
		const processedYamlText = processTemplateVariablesForYaml(frontmatterContent, taskData);

		// Then parse the processed YAML
		const parsedFrontmatter = parseYaml(processedYamlText);

		// Return empty object if parsing failed or result is not an object
		if (typeof parsedFrontmatter !== "object" || parsedFrontmatter === null) {
			console.warn("Template frontmatter did not parse to a valid object");
			return {};
		}

		return parsedFrontmatter;
	} catch (error) {
		console.error("Error processing template frontmatter:", error);
		return {};
	}
}

/**
 * Process template variables in body content
 */
function processTemplateBody(
	bodyContent: string,
	taskData: TemplateData | ICSTemplateData
): string {
	return processTemplateVariables(bodyContent, taskData);
}

/**
 * Process template variables for YAML frontmatter with proper quoting
 * This version ensures that values that could break YAML parsing are properly quoted
 */
function processTemplateVariablesForYaml(
	template: string,
	taskData: TemplateData | ICSTemplateData
): string {
	let result = template;
	const now = new Date();

	// {{title}} - Task title (quote if contains special characters)
	const title = taskData.title || "";
	const quotedTitle = needsYamlQuoting(title) ? `"${escapeYamlString(title)}"` : title;
	result = result.replace(/\{\{title\}\}/g, quotedTitle);

	// {{priority}} - Task priority
	result = result.replace(/\{\{priority\}\}/g, taskData.priority || "");

	// {{status}} - Task status
	result = result.replace(/\{\{status\}\}/g, taskData.status || "");

	// {{contexts}} - Task contexts (comma-separated)
	const contexts = Array.isArray(taskData.contexts) ? taskData.contexts.join(", ") : "";
	result = result.replace(/\{\{contexts\}\}/g, contexts);

	// {{tags}} - Task tags (comma-separated)
	const tags = Array.isArray(taskData.tags) ? taskData.tags.join(", ") : "";
	result = result.replace(/\{\{tags\}\}/g, tags);

	// {{hashtags}} - Task tags as space-separated hashtags
	const hashtags = Array.isArray(taskData.tags)
		? taskData.tags.map((tag) => `#${tag}`).join(" ")
		: "";
	result = result.replace(/\{\{hashtags\}\}/g, hashtags);

	// {{timeEstimate}} - Time estimate in minutes
	result = result.replace(/\{\{timeEstimate\}\}/g, taskData.timeEstimate?.toString() || "");

	// {{dueDate}} - Due date
	result = result.replace(/\{\{dueDate\}\}/g, taskData.dueDate || "");

	// {{scheduledDate}} - Scheduled date
	result = result.replace(/\{\{scheduledDate\}\}/g, taskData.scheduledDate || "");

	// {{details}} - User-provided details/description
	result = result.replace(/\{\{details\}\}/g, taskData.details || "");

	// {{parentNote}} - Parent note name/path - ALWAYS quote for YAML safety
	const parentNote = taskData.parentNote || "";
	const quotedParentNote = parentNote ? `"${escapeYamlString(parentNote)}"` : "";
	result = result.replace(/\{\{parentNote\}\}/g, quotedParentNote);

	// {{date}} - Current date (basic format only)
	result = result.replace(/\{\{date\}\}/g, format(now, "yyyy-MM-dd"));

	// {{time}} - Current time (basic format only)
	result = result.replace(/\{\{time\}\}/g, format(now, "HH:mm"));

	// Extended date/time variables (consistent with filename templates)
	result = result.replace(/\{\{year\}\}/g, format(now, "yyyy"));
	result = result.replace(/\{\{month\}\}/g, format(now, "MM"));
	result = result.replace(/\{\{day\}\}/g, format(now, "dd"));
	result = result.replace(/\{\{hour\}\}/g, format(now, "HH"));
	result = result.replace(/\{\{minute\}\}/g, format(now, "mm"));
	result = result.replace(/\{\{second\}\}/g, format(now, "ss"));
	result = result.replace(/\{\{timestamp\}\}/g, format(now, "yyyy-MM-dd-HHmmss"));
	result = result.replace(/\{\{dateTime\}\}/g, format(now, "yyyy-MM-dd-HHmm"));
	result = result.replace(/\{\{shortDate\}\}/g, format(now, "yyMMdd"));
	result = result.replace(/\{\{shortYear\}\}/g, format(now, "yy"));
	result = result.replace(/\{\{monthName\}\}/g, format(now, "MMMM"));
	result = result.replace(/\{\{monthNameShort\}\}/g, format(now, "MMM"));
	result = result.replace(/\{\{dayName\}\}/g, format(now, "EEEE"));
	result = result.replace(/\{\{dayNameShort\}\}/g, format(now, "EEE"));
	result = result.replace(/\{\{week\}\}/g, format(now, "ww"));
	result = result.replace(/\{\{quarter\}\}/g, format(now, "q"));
	result = result.replace(/\{\{time12\}\}/g, format(now, "hh:mm a"));
	result = result.replace(/\{\{time24\}\}/g, format(now, "HH:mm"));
	result = result.replace(/\{\{hourPadded\}\}/g, format(now, "HH"));
	result = result.replace(/\{\{hour12\}\}/g, format(now, "hh"));
	result = result.replace(/\{\{ampm\}\}/g, format(now, "a"));
	result = result.replace(/\{\{unix\}\}/g, Math.floor(now.getTime() / 1000).toString());
	result = result.replace(/\{\{unixMs\}\}/g, now.getTime().toString());
	result = result.replace(/\{\{milliseconds\}\}/g, format(now, "SSS"));
	result = result.replace(/\{\{ms\}\}/g, format(now, "SSS"));
	result = result.replace(/\{\{timezone\}\}/g, format(now, "xxx"));
	result = result.replace(/\{\{timezoneShort\}\}/g, format(now, "xx"));
	result = result.replace(/\{\{utcOffset\}\}/g, format(now, "xxx"));
	result = result.replace(/\{\{utcOffsetShort\}\}/g, format(now, "xx"));
	result = result.replace(/\{\{utcZ\}\}/g, "Z");

	// Date-based identifiers (consistent with filename templates)
	const datePart = format(now, "yyMMdd");
	const midnight = new Date(now);
	midnight.setHours(0, 0, 0, 0);
	const secondsSinceMidnight = Math.floor((now.getTime() - midnight.getTime()) / 1000);
	const zettelId = `${datePart}${secondsSinceMidnight.toString(36)}`;
	result = result.replace(/\{\{zettel\}\}/g, zettelId);
	result = result.replace(/\{\{nano\}\}/g, Date.now().toString() + Math.random().toString(36).substring(2, 7));

	// Priority and status variations
	const priority = taskData.priority || "";
	const status = taskData.status || "";
	result = result.replace(/\{\{priorityShort\}\}/g, priority.substring(0, 1).toUpperCase());
	result = result.replace(/\{\{statusShort\}\}/g, status.substring(0, 1).toUpperCase());

	// Title variations
	const titleForVariations = taskData.title || "";
	result = result.replace(/\{\{titleLower\}\}/g, titleForVariations.toLowerCase());
	result = result.replace(/\{\{titleUpper\}\}/g, titleForVariations.toUpperCase());
	result = result.replace(/\{\{titleSnake\}\}/g, titleForVariations.toLowerCase().replace(/\s+/g, "_"));
	result = result.replace(/\{\{titleKebab\}\}/g, titleForVariations.toLowerCase().replace(/\s+/g, "-"));
	result = result.replace(
		/\{\{titleCamel\}\}/g,
		titleForVariations
			.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
				index === 0 ? word.toLowerCase() : word.toUpperCase()
			)
			.replace(/\s+/g, "")
	);
	result = result.replace(
		/\{\{titlePascal\}\}/g,
		titleForVariations
			.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
			.replace(/\s+/g, "")
	);

	// ICS Event template variables (only available if taskData is ICSTemplateData)
	if ("icsEventTitle" in taskData) {
		const icsData = taskData as ICSTemplateData;

		// {{icsEventTitle}} - ICS event title (quote if contains special characters)
		const icsTitle = icsData.icsEventTitle || "";
		const quotedIcsTitle = needsYamlQuoting(icsTitle)
			? `"${escapeYamlString(icsTitle)}"`
			: icsTitle;
		result = result.replace(/\{\{icsEventTitle\}\}/g, quotedIcsTitle);

		// {{icsEventStart}} - ICS event start time
		result = result.replace(/\{\{icsEventStart\}\}/g, icsData.icsEventStart || "");

		// {{icsEventEnd}} - ICS event end time
		result = result.replace(/\{\{icsEventEnd\}\}/g, icsData.icsEventEnd || "");

		// {{icsEventLocation}} - ICS event location (quote if contains special characters)
		const icsLocation = icsData.icsEventLocation || "";
		const quotedIcsLocation =
			icsLocation && needsYamlQuoting(icsLocation)
				? `"${escapeYamlString(icsLocation)}"`
				: icsLocation;
		result = result.replace(/\{\{icsEventLocation\}\}/g, quotedIcsLocation);

		// {{icsEventDescription}} - ICS event description (quote if contains special characters)
		const icsDescription = icsData.icsEventDescription || "";
		const quotedIcsDescription =
			icsDescription && needsYamlQuoting(icsDescription)
				? `"${escapeYamlString(icsDescription)}"`
				: icsDescription;
		result = result.replace(/\{\{icsEventDescription\}\}/g, quotedIcsDescription);

		// {{icsEventUrl}} - ICS event URL
		result = result.replace(/\{\{icsEventUrl\}\}/g, icsData.icsEventUrl || "");

		// {{icsEventSubscription}} - ICS subscription name (quote if contains special characters)
		const icsSubscription = icsData.icsEventSubscription || "";
		const quotedIcsSubscription =
			icsSubscription && needsYamlQuoting(icsSubscription)
				? `"${escapeYamlString(icsSubscription)}"`
				: icsSubscription;
		result = result.replace(/\{\{icsEventSubscription\}\}/g, quotedIcsSubscription);

		// {{icsEventId}} - ICS event ID (ALWAYS quote for YAML safety since it's a UUID)
		const icsEventId = icsData.icsEventId || "";
		const quotedIcsEventId = icsEventId ? `"${escapeYamlString(icsEventId)}"` : "";
		result = result.replace(/\{\{icsEventId\}\}/g, quotedIcsEventId);
	}

	return result;
}

/**
 * Check if a string needs YAML quoting
 */
function needsYamlQuoting(str: string): boolean {
	if (!str) return false;

	// Check for characters that have special meaning in YAML
	const yamlSpecialChars = /[[\]{}:>|*&!%#`@,]/;
	const startsWithSpecial = /^[-?]/;
	const looksLikeNumber = /^\d+\.?\d*$/;
	const looksLikeBoolean = /^(true|false|yes|no|on|off)$/i;

	return (
		yamlSpecialChars.test(str) ||
		startsWithSpecial.test(str) ||
		looksLikeNumber.test(str) ||
		looksLikeBoolean.test(str)
	);
}

/**
 * Escape a string for safe use in YAML quotes
 */
function escapeYamlString(str: string): string {
	if (!str) return "";

	// Escape backslashes and double quotes
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Process task template variables like {{title}}, {{priority}}, {{status}}, etc.
 * This is the core variable replacement function used by both frontmatter and body processing
 */
function processTemplateVariables(
	template: string,
	taskData: TemplateData | ICSTemplateData
): string {
	let result = template;
	const now = new Date();

	// {{title}} - Task title
	result = result.replace(/\{\{title\}\}/g, taskData.title || "");

	// {{priority}} - Task priority
	result = result.replace(/\{\{priority\}\}/g, taskData.priority || "");

	// {{status}} - Task status
	result = result.replace(/\{\{status\}\}/g, taskData.status || "");

	// {{contexts}} - Task contexts (comma-separated)
	const contexts = Array.isArray(taskData.contexts) ? taskData.contexts.join(", ") : "";
	result = result.replace(/\{\{contexts\}\}/g, contexts);

	// {{tags}} - Task tags (comma-separated)
	const tags = Array.isArray(taskData.tags) ? taskData.tags.join(", ") : "";
	result = result.replace(/\{\{tags\}\}/g, tags);

	// {{hashtags}} - Task tags as space-separated hashtags
	const hashtags = Array.isArray(taskData.tags)
		? taskData.tags.map((tag) => `#${tag}`).join(" ")
		: "";
	result = result.replace(/\{\{hashtags\}\}/g, hashtags);

	// {{timeEstimate}} - Time estimate in minutes
	result = result.replace(/\{\{timeEstimate\}\}/g, taskData.timeEstimate?.toString() || "");

	// {{dueDate}} - Due date
	result = result.replace(/\{\{dueDate\}\}/g, taskData.dueDate || "");

	// {{scheduledDate}} - Scheduled date
	result = result.replace(/\{\{scheduledDate\}\}/g, taskData.scheduledDate || "");

	// {{details}} - User-provided details/description
	result = result.replace(/\{\{details\}\}/g, taskData.details || "");

	// {{parentNote}} - Parent note name/path where task was created
	result = result.replace(/\{\{parentNote\}\}/g, taskData.parentNote || "");

	// {{date}} - Current date (basic format only)
	result = result.replace(/\{\{date\}\}/g, format(now, "yyyy-MM-dd"));

	// {{time}} - Current time (basic format only)
	result = result.replace(/\{\{time\}\}/g, format(now, "HH:mm"));

	// Extended date/time variables (consistent with filename templates)
	result = result.replace(/\{\{year\}\}/g, format(now, "yyyy"));
	result = result.replace(/\{\{month\}\}/g, format(now, "MM"));
	result = result.replace(/\{\{day\}\}/g, format(now, "dd"));
	result = result.replace(/\{\{hour\}\}/g, format(now, "HH"));
	result = result.replace(/\{\{minute\}\}/g, format(now, "mm"));
	result = result.replace(/\{\{second\}\}/g, format(now, "ss"));
	result = result.replace(/\{\{timestamp\}\}/g, format(now, "yyyy-MM-dd-HHmmss"));
	result = result.replace(/\{\{dateTime\}\}/g, format(now, "yyyy-MM-dd-HHmm"));
	result = result.replace(/\{\{shortDate\}\}/g, format(now, "yyMMdd"));
	result = result.replace(/\{\{shortYear\}\}/g, format(now, "yy"));
	result = result.replace(/\{\{monthName\}\}/g, format(now, "MMMM"));
	result = result.replace(/\{\{monthNameShort\}\}/g, format(now, "MMM"));
	result = result.replace(/\{\{dayName\}\}/g, format(now, "EEEE"));
	result = result.replace(/\{\{dayNameShort\}\}/g, format(now, "EEE"));
	result = result.replace(/\{\{week\}\}/g, format(now, "ww"));
	result = result.replace(/\{\{quarter\}\}/g, format(now, "q"));
	result = result.replace(/\{\{time12\}\}/g, format(now, "hh:mm a"));
	result = result.replace(/\{\{time24\}\}/g, format(now, "HH:mm"));
	result = result.replace(/\{\{hourPadded\}\}/g, format(now, "HH"));
	result = result.replace(/\{\{hour12\}\}/g, format(now, "hh"));
	result = result.replace(/\{\{ampm\}\}/g, format(now, "a"));
	result = result.replace(/\{\{unix\}\}/g, Math.floor(now.getTime() / 1000).toString());
	result = result.replace(/\{\{unixMs\}\}/g, now.getTime().toString());
	result = result.replace(/\{\{milliseconds\}\}/g, format(now, "SSS"));
	result = result.replace(/\{\{ms\}\}/g, format(now, "SSS"));
	result = result.replace(/\{\{timezone\}\}/g, format(now, "xxx"));
	result = result.replace(/\{\{timezoneShort\}\}/g, format(now, "xx"));
	result = result.replace(/\{\{utcOffset\}\}/g, format(now, "xxx"));
	result = result.replace(/\{\{utcOffsetShort\}\}/g, format(now, "xx"));
	result = result.replace(/\{\{utcZ\}\}/g, "Z");

	// Date-based identifiers (consistent with filename templates)
	const datePartBody = format(now, "yyMMdd");
	const midnightBody = new Date(now);
	midnightBody.setHours(0, 0, 0, 0);
	const secondsSinceMidnightBody = Math.floor((now.getTime() - midnightBody.getTime()) / 1000);
	const zettelIdBody = `${datePartBody}${secondsSinceMidnightBody.toString(36)}`;
	result = result.replace(/\{\{zettel\}\}/g, zettelIdBody);
	result = result.replace(/\{\{nano\}\}/g, Date.now().toString() + Math.random().toString(36).substring(2, 7));

	// Priority and status variations
	const priority = taskData.priority || "";
	const status = taskData.status || "";
	result = result.replace(/\{\{priorityShort\}\}/g, priority.substring(0, 1).toUpperCase());
	result = result.replace(/\{\{statusShort\}\}/g, status.substring(0, 1).toUpperCase());

	// Title variations
	const titleForVariations = taskData.title || "";
	result = result.replace(/\{\{titleLower\}\}/g, titleForVariations.toLowerCase());
	result = result.replace(/\{\{titleUpper\}\}/g, titleForVariations.toUpperCase());
	result = result.replace(/\{\{titleSnake\}\}/g, titleForVariations.toLowerCase().replace(/\s+/g, "_"));
	result = result.replace(/\{\{titleKebab\}\}/g, titleForVariations.toLowerCase().replace(/\s+/g, "-"));
	result = result.replace(
		/\{\{titleCamel\}\}/g,
		titleForVariations
			.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
				index === 0 ? word.toLowerCase() : word.toUpperCase()
			)
			.replace(/\s+/g, "")
	);
	result = result.replace(
		/\{\{titlePascal\}\}/g,
		titleForVariations
			.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
			.replace(/\s+/g, "")
	);

	// ICS Event template variables (only available if taskData is ICSTemplateData)
	if ("icsEventTitle" in taskData) {
		const icsData = taskData as ICSTemplateData;

		// {{icsEventTitle}} - ICS event title
		result = result.replace(/\{\{icsEventTitle\}\}/g, icsData.icsEventTitle || "");

		// {{icsEventStart}} - ICS event start time
		result = result.replace(/\{\{icsEventStart\}\}/g, icsData.icsEventStart || "");

		// {{icsEventEnd}} - ICS event end time
		result = result.replace(/\{\{icsEventEnd\}\}/g, icsData.icsEventEnd || "");

		// {{icsEventLocation}} - ICS event location
		result = result.replace(/\{\{icsEventLocation\}\}/g, icsData.icsEventLocation || "");

		// {{icsEventDescription}} - ICS event description
		result = result.replace(/\{\{icsEventDescription\}\}/g, icsData.icsEventDescription || "");

		// {{icsEventUrl}} - ICS event URL
		result = result.replace(/\{\{icsEventUrl\}\}/g, icsData.icsEventUrl || "");

		// {{icsEventSubscription}} - ICS subscription name
		result = result.replace(
			/\{\{icsEventSubscription\}\}/g,
			icsData.icsEventSubscription || ""
		);

		// {{icsEventId}} - ICS event ID
		result = result.replace(/\{\{icsEventId\}\}/g, icsData.icsEventId || "");
	}

	return result;
}

/**
 * Merge template frontmatter with task frontmatter
 * User-defined values take precedence over template frontmatter
 */
export function mergeTemplateFrontmatter(
	baseFrontmatter: Record<string, any>,
	templateFrontmatter: Record<string, any>
): Record<string, any> {
	// User-defined values (baseFrontmatter) take precedence over template values
	return {
		...templateFrontmatter,
		...baseFrontmatter,
	};
}
