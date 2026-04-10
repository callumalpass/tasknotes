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
	description: "Start time tracking for a task",
	flags: {
		path: {
			value: "<path>",
			description: "Exact task file path",
		},
		title: {
			value: "<title>",
			description: "Exact task title",
		},
		query: {
			value: "<text>",
			description: "Substring match against task title or path",
		},
		description: {
			value: "<text>",
			description: "Optional description for the started time entry",
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
