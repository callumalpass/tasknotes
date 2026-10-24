import { uiText } from "../../i18n/runtime";
import { msg } from "@lingui/core/macro";
import type { CliData } from "obsidian";
import type { CliCommandDefinition } from "../types";
import { formatCliJson, formatTaskSummary } from "../helpers/formatters";
import { buildTaskCreationDataFromCli } from "../../services/buildTaskCreationDataFromCli";

export const captureCliCommand: CliCommandDefinition = {
	command: "capture",
	get description() { return uiText(msg({ message: "Create a TaskNotes task from free text or explicit flags", context: "cli/commands/captureCommand: defaults description" })); },
	flags: {
		text: {
			value: "<text>",
			get description() { return uiText(msg({ message: "Task text to parse with NLP unless --literal is set", context: "cli/commands/captureCommand: defaults description" })); },
		},
		title: {
			value: "<title>",
			get description() { return uiText(msg({ message: "Explicit task title; overrides NLP-derived title", context: "cli/commands/captureCommand: defaults description" })); },
		},
		details: {
			value: "<details>",
			get description() { return uiText(msg({ message: "Task details/body; overrides NLP-derived details", context: "cli/commands/captureCommand: defaults description" })); },
		},
		status: {
			value: "<status>",
			get description() { return uiText(msg({ message: "Explicit task status", context: "cli/commands/captureCommand: defaults description" })); },
		},
		priority: {
			value: "<priority>",
			get description() { return uiText(msg({ message: "Explicit task priority", context: "cli/commands/captureCommand: defaults description" })); },
		},
		due: {
			value: "<date>",
			get description() { return uiText(msg({ message: "Due date or datetime (YYYY-MM-DD or YYYY-MM-DDTHH:MM)", context: "cli/commands/captureCommand: defaults description" })); },
		},
		scheduled: {
			value: "<date>",
			get description() { return uiText(msg({ message: "Scheduled date or datetime (YYYY-MM-DD or YYYY-MM-DDTHH:MM)", context: "cli/commands/captureCommand: defaults description" })); },
		},
		tags: {
			value: "<tag1,tag2>",
			get description() { return uiText(msg({ message: "Comma-separated tags; overrides NLP-derived tags", context: "cli/commands/captureCommand: defaults description" })); },
		},
		contexts: {
			value: "<ctx1,ctx2>",
			get description() { return uiText(msg({ message: "Comma-separated contexts; overrides NLP-derived contexts", context: "cli/commands/captureCommand: defaults description" })); },
		},
		projects: {
			value: "<proj1,proj2>",
			get description() { return uiText(msg({ message: "Comma-separated projects; overrides NLP-derived projects", context: "cli/commands/captureCommand: defaults description" })); },
		},
		recurrence: {
			value: "<rrule>",
			get description() { return uiText(msg({ message: "Explicit recurrence rule", context: "cli/commands/captureCommand: defaults description" })); },
		},
		"recurrence-anchor": {
			value: "<scheduled|completion>",
			get description() { return uiText(msg({ message: "How recurring tasks advance: from the scheduled date or completion date", context: "cli/commands/captureCommand: defaults description" })); },
		},
		reminders: {
			value: "<spec>",
			get description() { return uiText(msg({ message: "Reminder spec(s): due:-PT1H;scheduled:-PT30M;at:2026-04-02T09:00 or a JSON array", context: "cli/commands/captureCommand: defaults description" })); },
		},
		estimate: {
			value: "<minutes>",
			get description() { return uiText(msg({ message: "Time estimate in minutes", context: "cli/commands/captureCommand: defaults description" })); },
		},
		literal: {
			get description() { return uiText(msg({ message: "Treat --text as a literal title instead of parsing it with NLP", context: "cli/commands/captureCommand: defaults description" })); },
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
