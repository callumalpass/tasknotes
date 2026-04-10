import type { CliData, CliFlags } from "obsidian";
import type TaskNotesPlugin from "../main";

export interface CliCommandDefinition {
	command: string;
	description: string;
	flags: CliFlags | null;
	handler: (plugin: TaskNotesPlugin, params: CliData) => string | Promise<string>;
}
