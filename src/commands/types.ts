import type { Editor, Hotkey, MarkdownView } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { MessageDescriptor } from "../i18n";

export interface TranslatedCommandDefinition {
	id: string;
	nameKey: MessageDescriptor;
	callback?: (plugin: TaskNotesPlugin) => void | Promise<void>;
	editorCallback?: (
		plugin: TaskNotesPlugin,
		editor: Editor,
		view: MarkdownView
	) => void | Promise<void>;
	checkCallback?: (checking: boolean) => boolean | void;
	hotkeys?: Hotkey[];
}
