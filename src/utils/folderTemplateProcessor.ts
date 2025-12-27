import { format } from "date-fns";

/**
 * Data for processing task-specific template variables
 */
export interface TaskTemplateData {
	title?: string;
	priority?: string;
	status?: string;
	contexts?: string[];
	projects?: string[];
	due?: string;
	scheduled?: string;
}

/**
 * Data for processing ICS event-specific template variables
 */
export interface ICSTemplateData {
	title?: string;
	location?: string;
	description?: string;
}

/**
 * Options for processing folder templates
 */
export interface FolderTemplateOptions {
	/**
	 * Date to use for date-based template variables
	 * @default new Date()
	 */
	date?: Date;

	/**
	 * Task-specific data for template variables
	 */
	taskData?: TaskTemplateData;

	/**
	 * ICS event-specific data for template variables
	 */
	icsData?: ICSTemplateData;

	/**
	 * Optional function to extract the basename from a project string
	 * Used to handle wikilink formatting and path resolution
	 */
	extractProjectBasename?: (project: string) => string;
}

/**
 * Process a folder path template by replacing template variables with actual values
 *
 * Supported template variables:
 *
 * Date variables:
 * - {{year}}, {{month}}, {{day}}, {{date}}
 * - {{time}}, {{timestamp}}, {{dateTime}}
 * - {{hour}}, {{minute}}, {{second}}
 * - {{shortDate}}, {{shortYear}}, {{monthName}}, {{monthNameShort}}
 * - {{dayName}}, {{dayNameShort}}
 * - {{week}}, {{quarter}}
 * - {{time12}}, {{time24}}, {{hourPadded}}, {{hour12}}, {{ampm}}
 * - {{unix}}, {{unixMs}}, {{milliseconds}}, {{ms}}
 * - {{timezone}}, {{timezoneShort}}, {{utcOffset}}, {{utcOffsetShort}}, {{utcZ}}
 * - {{zettel}}, {{nano}}
 *
 * Task variables (when taskData is provided):
 * - {{context}}, {{contexts}} - First context or all contexts joined with /
 * - {{project}}, {{projects}} - First project or all projects joined with /
 * - {{priority}}, {{priorityShort}}
 * - {{status}}, {{statusShort}}
 * - {{title}}, {{titleLower}}, {{titleUpper}}, {{titleSnake}}, {{titleKebab}}, {{titleCamel}}, {{titlePascal}}
 * - {{dueDate}}, {{scheduledDate}}
 *
 * ICS event variables (when icsData is provided):
 * - {{icsEventTitle}}, {{icsEventTitleLower}}, {{icsEventTitleUpper}}, etc.
 * - {{icsEventLocation}}
 * - {{icsEventDescription}}
 *
 * @param folderTemplate - The template string containing variables to replace
 * @param options - Options for processing the template
 * @returns The processed folder path with all variables replaced
 *
 * @example
 * ```ts
 * // Date-only template
 * processFolderTemplate("Daily/{{year}}/{{month}}/{{day}}", { date: new Date() })
 * // => "Daily/2025/10/05"
 *
 * // Task template
 * processFolderTemplate("Projects/{{project}}/{{status}}", {
 *   taskData: { projects: ["MyProject"], status: "active" }
 * })
 * // => "Projects/MyProject/active"
 *
 * // ICS event template
 * processFolderTemplate("Events/{{year}}/{{icsEventTitle}}", {
 *   date: new Date(),
 *   icsData: { title: "Team Meeting" }
 * })
 * // => "Events/2025/Team Meeting"
 * ```
 */
export function processFolderTemplate(
	folderTemplate: string,
	options: FolderTemplateOptions = {}
): string {
	if (!folderTemplate) {
		return folderTemplate;
	}

	const { date = new Date(), taskData, icsData, extractProjectBasename } = options;

	let processedPath = folderTemplate;

	// Replace task variables if taskData is provided
	if (taskData) {
		// Handle single context (first one if multiple)
		const context =
			Array.isArray(taskData.contexts) && taskData.contexts.length > 0
				? taskData.contexts[0]
				: "";
		processedPath = processedPath.replace(/\{\{context\}\}/g, context);

		// Handle single project (first one if multiple)
		const project =
			Array.isArray(taskData.projects) && taskData.projects.length > 0
				? extractProjectBasename
					? extractProjectBasename(taskData.projects[0])
					: taskData.projects[0]
				: "";
		processedPath = processedPath.replace(/\{\{project\}\}/g, project);

		// Handle multiple projects
		const projects =
			Array.isArray(taskData.projects) && taskData.projects.length > 0
				? taskData.projects
						.map((proj) => (extractProjectBasename ? extractProjectBasename(proj) : proj))
						.join("/")
				: "";
		processedPath = processedPath.replace(/\{\{projects\}\}/g, projects);

		// Handle multiple contexts
		const contexts =
			Array.isArray(taskData.contexts) && taskData.contexts.length > 0
				? taskData.contexts.join("/")
				: "";
		processedPath = processedPath.replace(/\{\{contexts\}\}/g, contexts);

		// Handle priority
		const priority = taskData.priority || "";
		processedPath = processedPath.replace(/\{\{priority\}\}/g, priority);

		// Handle status
		const status = taskData.status || "";
		processedPath = processedPath.replace(/\{\{status\}\}/g, status);

		// Handle title (sanitized for folder names)
		const title = taskData.title ? taskData.title.replace(/[<>:"/\\|?*]/g, "_") : "";
		processedPath = processedPath.replace(/\{\{title\}\}/g, title);

		// Handle due date and scheduled date
		const dueDate = taskData.due || "";
		processedPath = processedPath.replace(/\{\{dueDate\}\}/g, dueDate);

		const scheduledDate = taskData.scheduled || "";
		processedPath = processedPath.replace(/\{\{scheduledDate\}\}/g, scheduledDate);

		// Priority and status variations
		const priorityShort = priority ? priority.substring(0, 1).toUpperCase() : "";
		processedPath = processedPath.replace(/\{\{priorityShort\}\}/g, priorityShort);

		const statusShort = status ? status.substring(0, 1).toUpperCase() : "";
		processedPath = processedPath.replace(/\{\{statusShort\}\}/g, statusShort);

		// Title variations (all sanitized for folder names)
		const titleLower = title ? title.toLowerCase() : "";
		processedPath = processedPath.replace(/\{\{titleLower\}\}/g, titleLower);

		const titleUpper = title ? title.toUpperCase() : "";
		processedPath = processedPath.replace(/\{\{titleUpper\}\}/g, titleUpper);

		const titleSnake = title ? title.toLowerCase().replace(/\s+/g, "_") : "";
		processedPath = processedPath.replace(/\{\{titleSnake\}\}/g, titleSnake);

		const titleKebab = title ? title.toLowerCase().replace(/\s+/g, "-") : "";
		processedPath = processedPath.replace(/\{\{titleKebab\}\}/g, titleKebab);

		const titleCamel = title
			? title
					.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
						index === 0 ? word.toLowerCase() : word.toUpperCase()
					)
					.replace(/\s+/g, "")
			: "";
		processedPath = processedPath.replace(/\{\{titleCamel\}\}/g, titleCamel);

		const titlePascal = title
			? title
					.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
					.replace(/\s+/g, "")
			: "";
		processedPath = processedPath.replace(/\{\{titlePascal\}\}/g, titlePascal);
	}

	// Replace ICS event variables if icsData is provided
	if (icsData) {
		// Handle ICS event title (sanitized for folder names)
		const icsEventTitle = icsData.title ? icsData.title.replace(/[<>:"/\\|?*]/g, "_") : "";
		processedPath = processedPath.replace(/\{\{icsEventTitle\}\}/g, icsEventTitle);

		// ICS title variations (all sanitized for folder names)
		const icsEventTitleLower = icsEventTitle ? icsEventTitle.toLowerCase() : "";
		processedPath = processedPath.replace(/\{\{icsEventTitleLower\}\}/g, icsEventTitleLower);

		const icsEventTitleUpper = icsEventTitle ? icsEventTitle.toUpperCase() : "";
		processedPath = processedPath.replace(/\{\{icsEventTitleUpper\}\}/g, icsEventTitleUpper);

		const icsEventTitleSnake = icsEventTitle
			? icsEventTitle.toLowerCase().replace(/\s+/g, "_")
			: "";
		processedPath = processedPath.replace(/\{\{icsEventTitleSnake\}\}/g, icsEventTitleSnake);

		const icsEventTitleKebab = icsEventTitle
			? icsEventTitle.toLowerCase().replace(/\s+/g, "-")
			: "";
		processedPath = processedPath.replace(/\{\{icsEventTitleKebab\}\}/g, icsEventTitleKebab);

		const icsEventTitleCamel = icsEventTitle
			? icsEventTitle
					.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
						index === 0 ? word.toLowerCase() : word.toUpperCase()
					)
					.replace(/\s+/g, "")
			: "";
		processedPath = processedPath.replace(/\{\{icsEventTitleCamel\}\}/g, icsEventTitleCamel);

		const icsEventTitlePascal = icsEventTitle
			? icsEventTitle
					.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
					.replace(/\s+/g, "")
			: "";
		processedPath = processedPath.replace(/\{\{icsEventTitlePascal\}\}/g, icsEventTitlePascal);

		// Handle ICS event location (sanitized for folder names)
		const icsEventLocation = icsData.location
			? icsData.location.replace(/[<>:"/\\|?*]/g, "_")
			: "";
		processedPath = processedPath.replace(/\{\{icsEventLocation\}\}/g, icsEventLocation);

		// Handle ICS event description (sanitized for folder names)
		const icsEventDescription = icsData.description
			? icsData.description.replace(/[<>:"/\\|?*]/g, "_")
			: "";
		processedPath = processedPath.replace(/\{\{icsEventDescription\}\}/g, icsEventDescription);
	}

	// Replace date variables with current date values
	processedPath = processedPath.replace(/\{\{year\}\}/g, format(date, "yyyy"));
	processedPath = processedPath.replace(/\{\{month\}\}/g, format(date, "MM"));
	processedPath = processedPath.replace(/\{\{day\}\}/g, format(date, "dd"));
	processedPath = processedPath.replace(/\{\{date\}\}/g, format(date, "yyyy-MM-dd"));

	// Time variables
	processedPath = processedPath.replace(/\{\{time\}\}/g, format(date, "HHmmss"));
	processedPath = processedPath.replace(/\{\{timestamp\}\}/g, format(date, "yyyy-MM-dd-HHmmss"));
	processedPath = processedPath.replace(/\{\{dateTime\}\}/g, format(date, "yyyy-MM-dd-HHmm"));
	processedPath = processedPath.replace(/\{\{hour\}\}/g, format(date, "HH"));
	processedPath = processedPath.replace(/\{\{minute\}\}/g, format(date, "mm"));
	processedPath = processedPath.replace(/\{\{second\}\}/g, format(date, "ss"));

	// New date format variations
	processedPath = processedPath.replace(/\{\{shortDate\}\}/g, format(date, "yyMMdd"));
	processedPath = processedPath.replace(/\{\{shortYear\}\}/g, format(date, "yy"));
	processedPath = processedPath.replace(/\{\{monthName\}\}/g, format(date, "MMMM"));
	processedPath = processedPath.replace(/\{\{monthNameShort\}\}/g, format(date, "MMM"));
	processedPath = processedPath.replace(/\{\{dayName\}\}/g, format(date, "EEEE"));
	processedPath = processedPath.replace(/\{\{dayNameShort\}\}/g, format(date, "EEE"));
	processedPath = processedPath.replace(/\{\{week\}\}/g, format(date, "ww"));
	processedPath = processedPath.replace(/\{\{quarter\}\}/g, format(date, "q"));

	// Time variations
	processedPath = processedPath.replace(/\{\{time12\}\}/g, format(date, "hh:mm a"));
	processedPath = processedPath.replace(/\{\{time24\}\}/g, format(date, "HH:mm"));
	processedPath = processedPath.replace(/\{\{hourPadded\}\}/g, format(date, "HH"));
	processedPath = processedPath.replace(/\{\{hour12\}\}/g, format(date, "hh"));
	processedPath = processedPath.replace(/\{\{ampm\}\}/g, format(date, "a"));

	// Unix timestamp and milliseconds
	processedPath = processedPath.replace(
		/\{\{unix\}\}/g,
		Math.floor(date.getTime() / 1000).toString()
	);
	processedPath = processedPath.replace(/\{\{unixMs\}\}/g, date.getTime().toString());
	processedPath = processedPath.replace(/\{\{milliseconds\}\}/g, format(date, "SSS"));
	processedPath = processedPath.replace(/\{\{ms\}\}/g, format(date, "SSS"));

	// Timezone support
	processedPath = processedPath.replace(/\{\{timezone\}\}/g, format(date, "xxx"));
	processedPath = processedPath.replace(/\{\{timezoneShort\}\}/g, format(date, "xx"));
	processedPath = processedPath.replace(/\{\{utcOffset\}\}/g, format(date, "xxx"));
	processedPath = processedPath.replace(/\{\{utcOffsetShort\}\}/g, format(date, "xx"));
	processedPath = processedPath.replace(/\{\{utcZ\}\}/g, "Z");

	// Date-based identifiers
	const zettelId = (() => {
		const datePart = format(date, "yyMMdd");
		const midnight = new Date(date);
		midnight.setHours(0, 0, 0, 0);
		const secondsSinceMidnight = Math.floor((date.getTime() - midnight.getTime()) / 1000);
		const randomPart = secondsSinceMidnight.toString(36);
		return `${datePart}${randomPart}`;
	})();
	processedPath = processedPath.replace(/\{\{zettel\}\}/g, zettelId);

	const nanoId = Date.now().toString() + Math.random().toString(36).substring(2, 7);
	processedPath = processedPath.replace(/\{\{nano\}\}/g, nanoId);

	return processedPath;
}
