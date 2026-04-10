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
	description: "Show active time-tracking sessions, or detailed status for a specific task",
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
