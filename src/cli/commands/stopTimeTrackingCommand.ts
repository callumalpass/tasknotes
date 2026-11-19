import { uiText } from "../../i18n/runtime";
import { msg } from "@lingui/core/macro";
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
	get description() { return uiText(msg({ message: "Stop time tracking for a task, or for the only active session if unambiguous", context: "cli/commands/stopTimeTrackingCommand: defaults description" })); },
	flags: {
		path: {
			value: "<path>",
			get description() { return uiText(msg({ message: "Exact task file path", context: "cli/commands/stopTimeTrackingCommand: defaults description" })); },
		},
		title: {
			value: "<title>",
			get description() { return uiText(msg({ message: "Exact task title", context: "cli/commands/stopTimeTrackingCommand: defaults description" })); },
		},
		query: {
			value: "<text>",
			get description() { return uiText(msg({ message: "Substring match against task title or path", context: "cli/commands/stopTimeTrackingCommand: defaults description" })); },
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
