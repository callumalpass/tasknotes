import type TaskNotesPlugin from "../main";
import type { ParsedTaskData } from "../services/NaturalLanguageParser";
import type { TaskCreationData } from "../types";
import { combineDateAndTime, getCurrentTimestamp } from "./dateUtils";
import { sanitizeTags } from "./helpers";

interface BuildTaskCreationDataOptions {
	creationContext?: TaskCreationData["creationContext"];
}

export function buildTaskCreationDataFromParsed(
	plugin: TaskNotesPlugin,
	parsed: ParsedTaskData,
	options: BuildTaskCreationDataOptions = {}
): TaskCreationData {
	const now = getCurrentTimestamp();
	const taskData: TaskCreationData = {
		title: parsed.title.trim(),
		status: parsed.status || plugin.settings.defaultTaskStatus,
		priority: parsed.priority || plugin.settings.defaultTaskPriority,
		dateCreated: now,
		dateModified: now,
	};

	if (options.creationContext) {
		taskData.creationContext = options.creationContext;
	}

	if (parsed.dueDate) {
		taskData.due = parsed.dueTime
			? combineDateAndTime(parsed.dueDate, parsed.dueTime)
			: parsed.dueDate;
	}

	if (parsed.scheduledDate) {
		taskData.scheduled = parsed.scheduledTime
			? combineDateAndTime(parsed.scheduledDate, parsed.scheduledTime)
			: parsed.scheduledDate;
	}

	if (parsed.contexts && parsed.contexts.length > 0) {
		taskData.contexts = parsed.contexts;
	}

	if (parsed.projects && parsed.projects.length > 0) {
		taskData.projects = parsed.projects;
	}

	if (parsed.tags && parsed.tags.length > 0) {
		taskData.tags = parsed.tags.map((tag) => sanitizeTags(tag));
	}

	if (parsed.details) {
		taskData.details = parsed.details;
	}

	if (parsed.recurrence) {
		taskData.recurrence = parsed.recurrence;
	}

	if (parsed.estimate && parsed.estimate > 0) {
		taskData.timeEstimate = parsed.estimate;
	}

	if (parsed.userFields) {
		const userFieldDefs = plugin.settings.userFields || [];
		const customFrontmatter: Record<string, any> = {};

		for (const [fieldId, value] of Object.entries(parsed.userFields)) {
			const fieldDef = userFieldDefs.find((field) => field.id === fieldId);
			if (fieldDef) {
				customFrontmatter[fieldDef.key] = Array.isArray(value) ? value.join(", ") : value;
			}
		}

		if (Object.keys(customFrontmatter).length > 0) {
			taskData.customFrontmatter = customFrontmatter;
		}
	}

	return taskData;
}
