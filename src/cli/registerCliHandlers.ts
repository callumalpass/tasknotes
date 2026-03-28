import { requireApiVersion } from "obsidian";
import type TaskNotesPlugin from "../main";
import { captureCliCommand } from "./commands/captureCommand";
import type { CliCommandDefinition } from "./types";

const CLI_COMMANDS: CliCommandDefinition[] = [captureCliCommand];

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
			definition.flags,
			(params) => definition.handler(plugin, params)
		);
	}
}
