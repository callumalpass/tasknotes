import type { CliData } from "obsidian";
import type { CliCommandDefinition } from "../types";
import { formatCliJson, formatTaskSummary } from "../helpers/formatters";
import { buildTaskCreationDataFromCli } from "../../utils/buildTaskCreationDataFromCli";

export const captureCliCommand: CliCommandDefinition = {
	command: "capture",
	description: "Create a TaskNotes task from free text or explicit flags",
	flags: {
		text: {
			value: "<text>",
			description: "Task text to parse with NLP unless --literal is set",
		},
		title: {
			value: "<title>",
			description: "Explicit task title; overrides NLP-derived title",
		},
		details: {
			value: "<details>",
			description: "Task details/body; overrides NLP-derived details",
		},
		status: {
			value: "<status>",
			description: "Explicit task status",
		},
		priority: {
			value: "<priority>",
			description: "Explicit task priority",
		},
		due: {
			value: "<date>",
			description: "Due date or datetime (YYYY-MM-DD or YYYY-MM-DDTHH:MM)",
		},
		scheduled: {
			value: "<date>",
			description: "Scheduled date or datetime (YYYY-MM-DD or YYYY-MM-DDTHH:MM)",
		},
		tags: {
			value: "<tag1,tag2>",
			description: "Comma-separated tags; overrides NLP-derived tags",
		},
		contexts: {
			value: "<ctx1,ctx2>",
			description: "Comma-separated contexts; overrides NLP-derived contexts",
		},
		projects: {
			value: "<proj1,proj2>",
			description: "Comma-separated projects; overrides NLP-derived projects",
		},
		recurrence: {
			value: "<rrule>",
			description: "Explicit recurrence rule",
		},
		"recurrence-anchor": {
			value: "<scheduled|completion>",
			description: "How recurring tasks advance: from the scheduled date or completion date",
		},
		reminders: {
			value: "<spec>",
			description: "Reminder spec(s): due:-PT1H;scheduled:-PT30M;at:2026-04-02T09:00 or a JSON array",
		},
		estimate: {
			value: "<minutes>",
			description: "Time estimate in minutes",
		},
		literal: {
			description: "Treat --text as a literal title instead of parsing it with NLP",
		},
	},
	async handler(plugin, params: CliData): Promise<string> {
		const { taskData, usedNlp } = buildTaskCreationDataFromCli(plugin, params);
		const result = await plugin.taskService.createTask(taskData);
		return formatCliJson({
			...formatTaskSummary(result.taskInfo),
			usedNlp,
		});
	},
};
