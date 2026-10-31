import { uiText } from "../../i18n/runtime";
import { msg } from "@lingui/core/macro";
import type { CliData } from "obsidian";
import type { CliCommandDefinition } from "../types";
import { formatCliJson } from "../helpers/formatters";
import { resolveTaskForCli } from "../helpers/taskResolution";
import {
	formatTimeTrackingResult,
	startTimeTrackingForTask,
} from "../helpers/timeTracking";

export const startTimeTrackingCliCommand: CliCommandDefinition = {
	command: "start-time",
	get description() { return uiText(msg({ message: "Start time tracking for a task", context: "cli/commands/startTimeTrackingCommand: defaults description" })); },
	flags: {
		path: {
			value: "<path>",
			get description() { return uiText(msg({ message: "Exact task file path", context: "cli/commands/startTimeTrackingCommand: defaults description" })); },
		},
		title: {
			value: "<title>",
			get description() { return uiText(msg({ message: "Exact task title", context: "cli/commands/startTimeTrackingCommand: defaults description" })); },
		},
		query: {
			value: "<text>",
			get description() { return uiText(msg({ message: "Substring match against task title or path", context: "cli/commands/startTimeTrackingCommand: defaults description" })); },
		},
		description: {
			value: "<text>",
			get description() { return uiText(msg({ message: "Optional description for the started time entry", context: "cli/commands/startTimeTrackingCommand: defaults description" })); },
		},
	},
	async handler(plugin, params: CliData): Promise<string> {
		const task = await resolveTaskForCli(plugin, {
			path: params.path,
			title: params.title,
			query: params.query,
		});
		const updatedTask = await startTimeTrackingForTask(plugin, task, params.description);
		return formatCliJson(formatTimeTrackingResult(updatedTask));
	},
};
