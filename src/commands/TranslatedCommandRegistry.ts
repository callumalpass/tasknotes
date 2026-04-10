import type { Command, Editor, MarkdownView } from "obsidian";
import type TaskNotesPlugin from "../main";
import { createTaskNotesCommandDefinitions } from "./taskNotesCommands";
import type { TranslatedCommandDefinition } from "./types";

export class TranslatedCommandRegistry {
	private definitions: TranslatedCommandDefinition[] = [];
	private registeredCommands = new Map<string, string>();

	constructor(private plugin: TaskNotesPlugin) {}

	register(): void {
		this.definitions = createTaskNotesCommandDefinitions(this.plugin);
		this.registerCommands();
	}

	refreshTranslations(): void {
		if (!this.definitions.length) {
			return;
		}

		const commandsApi = this.plugin.app.commands;
		if (!commandsApi) {
			return;
		}

		const removeCommand = (commandsApi as any).removeCommand as
			| ((id: string) => void)
			| undefined;
		if (typeof removeCommand === "function") {
			for (const fullId of this.registeredCommands.values()) {
				removeCommand.call(commandsApi, fullId);
			}
			this.registerCommands();
			return;
		}

		for (const definition of this.definitions) {
			const fullId =
				this.registeredCommands.get(definition.id) ??
				`${this.plugin.manifest.id}:${definition.id}`;
			const command = (commandsApi as any).commands?.[fullId];
			if (command) {
				command.name = this.plugin.i18n.translate(definition.nameKey);
				if (typeof (commandsApi as any).updateCommand === "function") {
					(commandsApi as any).updateCommand(fullId, command);
				}
			}
		}
	}

	private registerCommands(): void {
		this.registeredCommands.clear();
		for (const definition of this.definitions) {
			const commandConfig: Command = {
				id: definition.id,
				name: this.plugin.i18n.translate(definition.nameKey),
			};
			if (definition.callback) {
				commandConfig.callback = () => {
					void definition.callback?.(this.plugin);
				};
			}
			if (definition.editorCallback) {
				commandConfig.editorCallback = (editor: Editor, view: MarkdownView) => {
					void definition.editorCallback?.(this.plugin, editor, view);
				};
			}
			if (definition.checkCallback) {
				commandConfig.checkCallback = definition.checkCallback;
			}
			if (definition.hotkeys) {
				commandConfig.hotkeys = definition.hotkeys;
			}
			const registered = this.plugin.addCommand(commandConfig);
			this.registeredCommands.set(definition.id, registered.id);
		}
	}
}
