import type { Editor, Hotkey, MarkdownView } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TranslationKey } from "../i18n";

export interface TranslatedCommandDefinition {
	id: string;
	nameKey: TranslationKey;
	callback?: (plugin: TaskNotesPlugin) => void | Promise<void>;
	editorCallback?: (
		plugin: TaskNotesPlugin,
		editor: Editor,
		view: MarkdownView
	) => void | Promise<void>;
	checkCallback?: (checking: boolean) => boolean | void;
	hotkeys?: Hotkey[];
}
