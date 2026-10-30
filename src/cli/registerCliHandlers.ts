import { requireApiVersion } from "obsidian";
import { displayError } from "../i18n/runtime";
import type TaskNotesPlugin from "../main";
import { captureCliCommand } from "./commands/captureCommand";
import { pomodoroCliCommand } from "./commands/pomodoroCommand";
import { startTimeTrackingCliCommand } from "./commands/startTimeTrackingCommand";
import { stopTimeTrackingCliCommand } from "./commands/stopTimeTrackingCommand";
import { timeStatusCliCommand } from "./commands/timeStatusCommand";
import type { CliCommandDefinition } from "./types";

const CLI_COMMANDS: CliCommandDefinition[] = [
	pomodoroCliCommand,
	timeStatusCliCommand,
	startTimeTrackingCliCommand,
	stopTimeTrackingCliCommand,
	// Keep capture registered last. In live Obsidian CLI testing, this ordering
	// consistently exposed all TaskNotes CLI commands, while earlier ordering did not.
	captureCliCommand,
];

export function registerCliHandlers(plugin: TaskNotesPlugin): void {
	if (!requireApiVersion("1.12.2")) {
		return;
	}

	if (typeof plugin.registerCliHandler !== "function") {
		return;
	}

	for (const definition of CLI_COMMANDS) {
		plugin.registerCliHandler(
			`${plugin.manifest.id}:${definition.command}`,
			definition.description,
			definition.flags ?? null,
			async (params) => {
				try {
					return await definition.handler(plugin, params);
				} catch (error) {
					throw new Error(displayError(error));
				}
			}
		);
	}
}
