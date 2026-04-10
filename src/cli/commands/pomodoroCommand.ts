import type { CliData } from "obsidian";
import type { CliCommandDefinition } from "../types";
import { formatCliJson } from "../helpers/formatters";
import { resolveTaskForCli } from "../helpers/taskResolution";
import type { PomodoroState, TaskInfo } from "../../types";

type PomodoroAction =
	| "status"
	| "start"
	| "pause"
	| "resume"
	| "stop"
	| "short-break"
	| "long-break";

function parseAction(value?: string): PomodoroAction {
	const normalized = value?.trim() || "status";
	switch (normalized) {
		case "status":
		case "start":
		case "pause":
		case "resume":
		case "stop":
		case "short-break":
		case "long-break":
			return normalized;
		default:
			throw new Error(
				"--action must be one of: status, start, pause, resume, stop, short-break, long-break"
			);
	}
}

function parseDuration(value?: string): number | undefined {
	if (!value) {
		return undefined;
	}

	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error("--duration must be a positive number of minutes");
	}

	return parsed;
}

function hasTaskLookup(params: CliData): boolean {
	return Boolean(params.path || params.title || params.query);
}

async function resolvePomodoroTask(
	plugin: any,
	params: CliData,
	required: boolean
): Promise<TaskInfo | undefined> {
	if (!hasTaskLookup(params)) {
		if (required) {
			throw new Error("A task reference is required: pass path, title, or query");
		}
		return undefined;
	}

	return resolveTaskForCli(plugin, {
		path: params.path,
		title: params.title,
		query: params.query,
	});
}

async function formatPomodoroState(plugin: any, state: PomodoroState): Promise<Record<string, unknown>> {
	const currentSession = state.currentSession;
	const task =
		currentSession?.taskPath
			? await plugin.cacheManager.getTaskInfo(currentSession.taskPath)
			: null;

	return {
		isRunning: state.isRunning,
		timeRemaining: state.timeRemaining,
		nextSessionType: state.nextSessionType ?? null,
		currentSession: currentSession
			? {
					id: currentSession.id,
					type: currentSession.type,
					startTime: currentSession.startTime,
					endTime: currentSession.endTime ?? null,
					plannedDuration: currentSession.plannedDuration,
					completed: currentSession.completed,
					interrupted: currentSession.interrupted ?? false,
					task: task
						? {
								title: task.title,
								path: task.path,
							}
						: currentSession.taskPath
							? {
									title: null,
									path: currentSession.taskPath,
								}
							: null,
				}
			: null,
	};
}

export const pomodoroCliCommand: CliCommandDefinition = {
	command: "pomodoro",
	description: "Control TaskNotes Pomodoro sessions or inspect the current Pomodoro state",
	flags: {
		action: {
			value: "<status|start|pause|resume|stop|short-break|long-break>",
			description: "Pomodoro action to perform (default: status)",
		},
		path: {
			value: "<path>",
			description: "Exact task file path for action=start",
		},
		title: {
			value: "<title>",
			description: "Exact task title for action=start",
		},
		query: {
			value: "<text>",
			description: "Substring match against task title or path for action=start",
		},
		duration: {
			value: "<minutes>",
			description: "Optional work-session duration override for action=start",
		},
	},
	async handler(plugin, params: CliData): Promise<string> {
		const action = parseAction(params.action);
		const duration = parseDuration(params.duration);

		switch (action) {
			case "status":
				return formatCliJson(await formatPomodoroState(plugin, plugin.pomodoroService.getState()));
			case "start": {
				const task = await resolvePomodoroTask(plugin, params, false);
				await plugin.pomodoroService.startPomodoro(task, duration);
				return formatCliJson(await formatPomodoroState(plugin, plugin.pomodoroService.getState()));
			}
			case "pause":
				await plugin.pomodoroService.pausePomodoro();
				return formatCliJson(await formatPomodoroState(plugin, plugin.pomodoroService.getState()));
			case "resume":
				await plugin.pomodoroService.resumePomodoro();
				return formatCliJson(await formatPomodoroState(plugin, plugin.pomodoroService.getState()));
			case "stop":
				await plugin.pomodoroService.stopPomodoro();
				return formatCliJson(await formatPomodoroState(plugin, plugin.pomodoroService.getState()));
			case "short-break":
				await plugin.pomodoroService.startBreak(false);
				return formatCliJson(await formatPomodoroState(plugin, plugin.pomodoroService.getState()));
			case "long-break":
				await plugin.pomodoroService.startBreak(true);
				return formatCliJson(await formatPomodoroState(plugin, plugin.pomodoroService.getState()));
		}
	},
};
