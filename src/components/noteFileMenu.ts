import { msg } from "@lingui/core/macro";
import { Menu, Notice, TFile } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { renameVaultFile } from "../services/VaultMutationService";
import { deleteNotesWithUndo } from "../ui/noteDeletion";
import { showTextInputModal } from "../modals/TextInputModal";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Components/NoteFileMenu" });

export interface NoteFileActionOptions {
	/** The task the note holds; Copy task title and task deletion need it. */
	task?: TaskInfo;
	/** Lead with Open, for a menu that is not already a task menu. */
	includeOpen?: boolean;
	/** Offer Open in new tab; the task menu has its own top-level item. Default true. */
	includeOpenInNewTab?: boolean;
	/** Offer Convert to task, for a note that is not a task. */
	offerConvert?: boolean;
	/** `source` passed to Obsidian's `file-menu` event. */
	source: string;
	onUpdate?: () => void;
}

/**
 * Note actions shared by the task menu's Note actions submenu and the menu
 * TaskNotes views show for notes that are not tasks.
 *
 * Obsidian groups a menu's items by section, in the order each section first
 * appears, and puts unsectioned items last. TaskNotes' own items therefore set
 * the sections Obsidian's file items use, so opening, file actions and copying
 * come first with Obsidian's and other plugins' items joining them, and Delete
 * is added after the `file-menu` event so it ends the menu.
 */
export function addNoteFileActions(
	menu: Menu,
	file: TFile,
	plugin: TaskNotesPlugin,
	options: NoteFileActionOptions
): void {
	const t = plugin.i18n.translate.bind(plugin.i18n);
	const { app } = plugin;
	const { task } = options;

	if (options.includeOpen) {
		menu.addItem((item) =>
			item
				.setSection("open")
				.setTitle(t(msg({ message: "Open", context: "ui.audit.open" })))
				.setIcon("file-text")
				.onClick(() => void app.workspace.getLeaf(false).openFile(file))
		);
	}
	if (options.includeOpenInNewTab !== false) {
		menu.addItem((item) =>
			item
				.setSection("open")
				.setTitle(t(msg({ message: "Open in new tab", context: "ui.audit.openNewTab" })))
				.setIcon("external-link")
				.onClick(() => void app.workspace.openLinkText(file.path, "", true))
		);
	}
	menu.addItem((item) =>
		item
			.setSection("open")
			.setTitle(t(msg({ message: "Open to the right", context: "note menu open split" })))
			.setIcon("separator-vertical")
			.onClick(() => void app.workspace.openLinkText(file.path, "", "split"))
	);

	if (options.offerConvert) {
		menu.addItem((item) =>
			item
				.setSection("tasknotes")
				.setTitle(t(msg({ message: "Convert to task", context: "note menu convert" })))
				.setIcon("check-square")
				.onClick(() => void plugin.convertNoteToTask(file))
		);
	}

	menu.addItem((item) =>
		item
			.setSection("action")
			.setTitle(t(msg({ message: "Rename", context: "contextMenus.task.rename" })))
			.setIcon("pencil")
			.onClick(() => void renameNote(plugin, file, options.onUpdate))
	);

	if (task) {
		menu.addItem((item) =>
			item
				.setSection("info.copy")
				.setTitle(t(msg({ message: "Copy task title", context: "contextMenus.task.copyTitle" })))
				.setIcon("copy")
				.onClick(() =>
					void copyText(
						plugin,
						task.title,
						t(msg({ message: "Task title copied to clipboard", context: "contextMenus.task.notices.copyTitleSuccess" }))
					)
				)
		);
	}
	menu.addItem((item) =>
		item
			.setSection("info.copy")
			.setTitle(t(msg({ message: "Copy Obsidian URL", context: "contextMenus.task.copyUrl" })))
			.setIcon("link")
			.onClick(() =>
				void copyText(
					plugin,
					`obsidian://open?vault=${encodeURIComponent(app.vault.getName())}&file=${encodeURIComponent(file.path)}`,
					t(msg({ message: "Obsidian URL copied to clipboard", context: "contextMenus.task.notices.copyUrlSuccess" }))
				)
			)
	);

	try {
		app.workspace.trigger("file-menu", menu, file, options.source);
	} catch (error) {
		tasknotesLogger.debug("Obsidian's file menu items are not available", {
			category: "stale-data",
			operation: "native-file-menu-unavailable",
			error,
		});
	}

	menu.addItem((item) =>
		item
			.setSection("danger")
			.setTitle(t(msg({ message: "Delete", context: "contextMenus.task.delete" })))
			.setIcon("trash")
			.setWarning(true)
			.onClick(() => void deleteNote(plugin, file, task, options.onUpdate))
	);
}

/** The menu TaskNotes views show for a note that is not a task. */
export function showNoteContextMenu(
	position: { x: number; y: number },
	file: TFile,
	plugin: TaskNotesPlugin,
	source: string
): void {
	const menu = new Menu();
	const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
	addNoteFileActions(menu, file, plugin, {
		includeOpen: true,
		offerConvert: file.extension === "md" && !(frontmatter && plugin.cacheManager.isTaskFile(frontmatter)),
		source,
	});
	menu.showAtPosition(position);
}

async function copyText(plugin: TaskNotesPlugin, text: string, success: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
		new Notice(success);
	} catch {
		new Notice(
			plugin.i18n.translate(
				msg({ message: "Failed to copy to clipboard", context: "contextMenus.task.notices.copyFailure" })
			)
		);
	}
}

async function renameNote(
	plugin: TaskNotesPlugin,
	file: TFile,
	onUpdate?: () => void
): Promise<void> {
	const t = plugin.i18n.translate.bind(plugin.i18n);
	try {
		const currentName = file.basename;
		const newName = await showTextInputModal(plugin.app, {
			title: t(msg({ message: "Rename file", context: "contextMenus.task.renameTitle" })),
			placeholder: t(msg({ message: "Enter new name", context: "contextMenus.task.renamePlaceholder" })),
			initialValue: currentName,
		});
		if (!newName || newName.trim() === "" || newName === currentName) return;
		const finalName = newName.endsWith(`.${file.extension}`) ? newName : `${newName}.${file.extension}`;
		const newPath = file.parent && !file.parent.isRoot() ? `${file.parent.path}/${finalName}` : finalName;
		await renameVaultFile(plugin.app, file, newPath);
		new Notice(
			t(msg({ message: 'Renamed to "{name}"', context: "contextMenus.task.notices.renameSuccess" }), {
				name: finalName,
			})
		);
		onUpdate?.();
	} catch (error) {
		tasknotesLogger.error("Error renaming file:", {
			category: "persistence",
			operation: "renaming-file",
			error,
		});
		new Notice(t(msg({ message: "Failed to rename file", context: "contextMenus.task.notices.renameFailure" })));
	}
}

async function deleteNote(
	plugin: TaskNotesPlugin,
	file: TFile,
	task: TaskInfo | undefined,
	onUpdate?: () => void
): Promise<void> {
	await deleteNotesWithUndo(plugin, [{ file, task }], onUpdate);
}
