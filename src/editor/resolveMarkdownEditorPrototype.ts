import { TFile, type App, type Constructor } from "obsidian";

interface WidgetEditorProbe {
	editable: boolean;
	editMode?: { destroy(): void };
	showEditor(): void;
	unload(): void;
}

/**
 * Obsidian does not export its embeddable editor constructor. Discover it from
 * a detached Markdown embed, without requiring the user to open a note first.
 */
export function resolveMarkdownEditorPrototype<T>(app: App): Constructor<T> {
	const active = app.workspace.getActiveFile();
	let file =
		active instanceof TFile && active.extension === "md"
			? active
			: app.vault.getMarkdownFiles()[0];
	if (!file) {
		// The internal TFile constructor accepts (vault, path). This is only a
		// detached object for the probe, not a vault.create() or registered file.
		// Do not load the embed: no file contents need to be read or saved.
		const DetachedFile = TFile as unknown as new (vault: App["vault"], path: string) => TFile;
		file = new DetachedFile(app.vault, "__tasknotes_editor_probe__.md");
	}

	const containerEl = activeWindow.createDiv();
	// @ts-expect-error - Obsidian's embed registry is an internal API.
	const widget = app.embedRegistry.embedByExtension.md(
		{ app, containerEl },
		file,
		""
	) as WidgetEditorProbe;
	try {
		widget.editable = true;
		widget.showEditor();
		const editor = widget.editMode;
		if (!editor) throw new Error("Markdown editor edit mode was not initialized");
		return Object.getPrototypeOf(Object.getPrototypeOf(editor)).constructor as Constructor<T>;
	} finally {
		try {
			// The probe was never loaded, so Component.unload() alone does not
			// destroy its CodeMirror instance or the extensions it initialized.
			widget.editMode?.destroy();
		} finally {
			widget.unload();
			containerEl.remove();
		}
	}
}
