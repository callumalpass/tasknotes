import { uiText } from "../../i18n/runtime";
import { msg } from "@lingui/core/macro";
import type { CliData } from "obsidian";
import type { CliCommandDefinition } from "../types";
import { formatCliJson } from "../helpers/formatters";
import { resolveTaskForCli } from "../helpers/taskResolution";
import {
	computeActiveTimeSessions,
	computeTaskTimeData,
} from "../../utils/timeTrackingUtils";

function hasExplicitLookup(params: CliData): boolean {
	return Boolean(params.path || params.title || params.query);
}

export const timeStatusCliCommand: CliCommandDefinition = {
	command: "time-status",
	get description() { return uiText(msg({ message: "Show active time-tracking sessions, or detailed status for a specific task", context: "cli/commands/timeStatusCommand: defaults description" })); },
	flags: {
		path: {
			value: "<path>",
			get description() { return uiText(msg({ message: "Exact task file path", context: "cli/commands/timeStatusCommand: defaults description" })); },
		},
		title: {
			value: "<title>",
			get description() { return uiText(msg({ message: "Exact task title", context: "cli/commands/timeStatusCommand: defaults description" })); },
		},
		query: {
			value: "<text>",
			get description() { return uiText(msg({ message: "Substring match against task title or path", context: "cli/commands/timeStatusCommand: defaults description" })); },
		},
	},
	async handler(plugin, params: CliData): Promise<string> {
		if (hasExplicitLookup(params)) {
			const task = await resolveTaskForCli(plugin, {
				path: params.path,
				title: params.title,
				query: params.query,
			});

			return formatCliJson(
				computeTaskTimeData(task, (candidate) => plugin.getActiveTimeSession(candidate))
			);
		}

		const allTasks = await plugin.cacheManager.getAllTasks();
		return formatCliJson(
			computeActiveTimeSessions(allTasks, (task) => plugin.getActiveTimeSession(task))
		);
	},
};
