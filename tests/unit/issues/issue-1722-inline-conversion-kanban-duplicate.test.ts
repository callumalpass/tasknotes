/**
 * Issue #1722: Inline task conversion creates duplicates in Kanban view until refresh
 *
 * Bug Description:
 * When an inline task on a note is converted into a tasknote, a duplicate of the task
 * is shown in the Kanban view until the view is closed and reopened. Both the old inline
 * task entry and the new tasknote file appear as separate cards.
 *
 * Root cause:
 * When converting an inline task to a tasknote file, the Bases data layer receives the new
 * file event and adds it to the data set. However, the stale inline task entry (keyed by
 * source file path + line) may persist in the KanbanView's currentTaskElements map and
 * taskInfoCache until a full data refresh from Bases removes the old inline item.
 * The KanbanView.handleTaskUpdate() calls debouncedRefresh(), but if Bases hasn't removed
 * the old inline item from its query results, both entries appear.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1722
 */

import { describe, it, expect, jest } from "@jest/globals";
import type { Editor } from "obsidian";
import { TFile } from "obsidian";
import { InstantTaskConvertService } from "../../../src/services/InstantTaskConvertService";

jest.mock("obsidian");

describe('Issue #1722: Inline task conversion Kanban duplicate', () => {
	function createService(editor: Editor, sourceFile: TFile) {
		const plugin = {
			app: {
				workspace: {
					activeEditor: {
						editor,
						file: sourceFile,
					},
					getActiveFile: jest.fn(() => sourceFile),
				},
				vault: {
					modify: jest.fn(async () => undefined),
				},
			},
			settings: {
				customStatuses: [],
				customPriorities: [],
				nlpDefaultToScheduled: false,
				nlpLanguage: "en",
				nlpTriggers: { triggers: [] },
				userFields: [],
			},
			notifyDataChanged: jest.fn(),
		};

		return {
			plugin,
			service: new InstantTaskConvertService(plugin as never, {} as never, {} as never),
		};
	}

	it("persists the source note after replacing the inline checkbox with a task link", async () => {
		const sourceFile = new TFile("Notes/daily.md");
		const editor = {
			getValue: jest.fn(() => "- [[Tasks/Buy groceries]]"),
		} as unknown as Editor;
		const { plugin, service } = createService(editor, sourceFile);

		const result = await (service as any).persistSourceNoteAfterReplacement(editor);

		expect(result).toBe(sourceFile);
		expect(plugin.app.vault.modify).toHaveBeenCalledWith(
			sourceFile,
			"- [[Tasks/Buy groceries]]"
		);
		expect(plugin.notifyDataChanged).toHaveBeenCalledWith("Notes/daily.md", false, false);
	});

	it("falls back to the active file when the active editor wrapper is unavailable", async () => {
		const sourceFile = new TFile("Notes/project.md");
		const editor = {
			getValue: jest.fn(() => "- [[Tasks/Call supplier]]"),
		} as unknown as Editor;
		const { plugin, service } = createService(editor, sourceFile);
		plugin.app.workspace.activeEditor = null;

		await (service as any).persistSourceNoteAfterReplacement(editor);

		expect(plugin.app.workspace.getActiveFile).toHaveBeenCalled();
		expect(plugin.app.vault.modify).toHaveBeenCalledWith(
			sourceFile,
			"- [[Tasks/Call supplier]]"
		);
	});
});
