import type { CliData } from "obsidian";
import type { CliCommandDefinition } from "../types";
import { formatCliJson } from "../helpers/formatters";
import { resolveTaskForCli } from "../helpers/taskResolution";
import {
	formatTimeTrackingResult,
	resolveTaskForStopTimeTracking,
} from "../helpers/timeTracking";

function hasExplicitLookup(params: CliData): boolean {
	return Boolean(params.path || params.title || params.query);
}

export const stopTimeTrackingCliCommand: CliCommandDefinition = {
	command: "stop-time",
	description: "Stop time tracking for a task, or for the only active session if unambiguous",
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
	},
	async handler(plugin, params: CliData): Promise<string> {
		const task = await resolveTaskForStopTimeTracking(plugin, async () => {
			if (!hasExplicitLookup(params)) {
				return null;
			}

			return resolveTaskForCli(plugin, {
				path: params.path,
				title: params.title,
				query: params.query,
			});
		});
		const updatedTask = await plugin.taskService.stopTimeTracking(task);
		return formatCliJson(formatTimeTrackingResult(updatedTask));
	},
};
