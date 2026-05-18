import type { CliData } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { Reminder, TaskCreationData } from "../types";
import { NaturalLanguageParser } from "../services/NaturalLanguageParser";
import { getCurrentTimestamp } from "./dateUtils";
import { sanitizeTags } from "./helpers";
import { buildTaskCreationDataFromParsed } from "./buildTaskCreationDataFromParsed";

export interface CliCaptureBuildResult {
	taskData: TaskCreationData;
	usedNlp: boolean;
}

function parseCsvList(value?: string): string[] | undefined {
	if (!value) {
		return undefined;
	}

	const items = value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);

	return items.length > 0 ? items : undefined;
}

function parseEstimate(value?: string): number | undefined {
	if (!value) {
		return undefined;
	}

	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new Error("--estimate must be a non-negative number of minutes");
	}

	return parsed;
}

function buildReminderId(index: number): string {
	return `rem_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 11)}`;
}

function normalizeAbsoluteTime(value: string): string {
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
		return `${value}:00`;
	}

	return value;
}

function parseReminderShorthand(value: string, index: number): Reminder {
	const trimmed = value.trim();

	if (trimmed.startsWith("at:")) {
		const absoluteTime = normalizeAbsoluteTime(trimmed.slice(3).trim());
		if (!absoluteTime) {
			throw new Error("Absolute reminders must use at:YYYY-MM-DDTHH:MM or full ISO datetime");
		}

		return {
			id: buildReminderId(index),
			type: "absolute",
			description: "Reminder",
			absoluteTime,
		};
	}

	const separatorIndex = trimmed.indexOf(":");
	if (separatorIndex === -1) {
		throw new Error(
			"Reminder shorthand must use due:<offset>, scheduled:<offset>, or at:<datetime>"
		);
	}

	const relatedTo = trimmed.slice(0, separatorIndex).trim();
	const offset = trimmed.slice(separatorIndex + 1).trim();
	if ((relatedTo !== "due" && relatedTo !== "scheduled") || !offset) {
		throw new Error(
			"Relative reminders must use due:<offset> or scheduled:<offset> with ISO 8601 durations like -PT1H"
		);
	}

	return {
		id: buildReminderId(index),
		type: "relative",
		description: "Reminder",
		relatedTo,
		offset,
	};
}

function parseReminders(value?: string): Reminder[] | undefined {
	if (!value) {
		return undefined;
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}

	if (trimmed.startsWith("[")) {
		const parsed = JSON.parse(trimmed);
		if (!Array.isArray(parsed)) {
			throw new Error("--reminders JSON must be an array");
		}

		return parsed as Reminder[];
	}

	const reminders = trimmed
		.split(";")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)
		.map((entry, index) => parseReminderShorthand(entry, index));

	return reminders.length > 0 ? reminders : undefined;
}

function parseRecurrenceAnchor(
	value?: string
): TaskCreationData["recurrence_anchor"] | undefined {
	if (!value) {
		return undefined;
	}

	if (value !== "scheduled" && value !== "completion") {
		throw new Error("--recurrence-anchor must be either 'scheduled' or 'completion'");
	}

	return value;
}

export function buildTaskCreationDataFromCli(
	plugin: TaskNotesPlugin,
	params: CliData
): CliCaptureBuildResult {
	const text = params.text?.trim();
	const titleOverride = params.title?.trim();
	const literal = params.literal === "true";

	let taskData: TaskCreationData;
	let usedNlp = false;

	if (text && !literal) {
		const parsed = NaturalLanguageParser.fromPlugin(plugin).parseInput(text);
		taskData = buildTaskCreationDataFromParsed(plugin, parsed, {
			creationContext: "api",
		});
		usedNlp = true;
	} else {
		const now = getCurrentTimestamp();
		const title = titleOverride || text;
		if (!title) {
			throw new Error("Either --text or --title is required");
		}

		taskData = {
			title,
			status: plugin.settings.defaultTaskStatus,
			priority: plugin.settings.defaultTaskPriority,
			dateCreated: now,
			dateModified: now,
			creationContext: "api",
		};
	}

	if (!taskData.title || taskData.title.trim() === "" || taskData.title === "Untitled Task") {
		if (!titleOverride) {
			throw new Error("Could not derive a task title from --text; pass --title to override");
		}
	}

	if (titleOverride) {
		taskData.title = titleOverride;
	}

	if (params.details) {
		taskData.details = params.details;
	}

	if (params.status) {
		taskData.status = params.status;
	}

	if (params.priority) {
		taskData.priority = params.priority;
	}

	if (params.due) {
		taskData.due = params.due;
	}

	if (params.scheduled) {
		taskData.scheduled = params.scheduled;
	}

	const tags = parseCsvList(params.tags);
	if (tags) {
		taskData.tags = tags.map((tag) => sanitizeTags(tag));
	}

	const contexts = parseCsvList(params.contexts);
	if (contexts) {
		taskData.contexts = contexts;
	}

	const projects = parseCsvList(params.projects);
	if (projects) {
		taskData.projects = projects;
	}

	if (params.recurrence) {
		taskData.recurrence = params.recurrence;
	}

	const recurrenceAnchor = parseRecurrenceAnchor(params["recurrence-anchor"]);
	if (recurrenceAnchor) {
		taskData.recurrence_anchor = recurrenceAnchor;
	}

	const estimate = parseEstimate(params.estimate);
	if (estimate !== undefined) {
		taskData.timeEstimate = estimate;
	}

	const reminders = parseReminders(params.reminders);
	if (reminders) {
		taskData.reminders = reminders;
	}

	return { taskData, usedNlp };
}
