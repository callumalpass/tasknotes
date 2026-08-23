import { TFile } from "obsidian";
import TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import { sanitizeLinkAliasText } from "../../../src/utils/linkAliasUtils";
import { App } from "../../helpers/obsidian-runtime";

describe("Issue #2247: create-inline-task link aliases", () => {
	it("strips nested wikilink markup from the inserted task-link alias", () => {
		const app = new App();
		const plugin = new TaskNotesPlugin(app as never, {} as never);
		const taskFile = new TFile("Tasks/some task John Smith.md");
		const editor = {
			replaceRange: jest.fn(),
			setCursor: jest.fn(),
		};

		plugin.app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(taskFile);
		plugin.app.workspace.getActiveFile = jest
			.fn()
			.mockReturnValue(new TFile("Notes/source.md"));
		plugin.app.fileManager.generateMarkdownLink = jest
			.fn()
			.mockImplementation((_file, _sourcePath, _subpath, alias) =>
				`[[some task John Smith|${alias}]]`
			);

		(plugin as any).handleInlineTaskCreated(
			{
				id: taskFile.path,
				path: taskFile.path,
				title: "some task [[John Smith]]",
				status: "open",
				priority: "normal",
				archived: false,
			} as TaskInfo,
			{ editor, insertionPoint: { line: 2, ch: 0 } }
		);

		expect(plugin.app.fileManager.generateMarkdownLink).toHaveBeenCalledWith(
			taskFile,
			"Notes/source.md",
			"",
			"some task John Smith"
		);
		expect(editor.replaceRange).toHaveBeenCalledWith(
			"[[some task John Smith|some task John Smith]]",
			{ line: 2, ch: 0 }
		);
	});

	it("flattens a wikilink nested inside a Markdown-link label", () => {
		expect(
			sanitizeLinkAliasText("review [the [[Projects/Q2|Q2]] plan](Projects/Q2.md)")
		).toBe("review the Q2 plan");
	});

	it("uses wikilink aliases and markdown-link labels in the inserted alias", () => {
		const app = new App();
		const plugin = new TaskNotesPlugin(app as never, {} as never);
		const taskFile = new TFile("Tasks/review Q2 with Sam.md");
		const editor = {
			replaceRange: jest.fn(),
			setCursor: jest.fn(),
		};

		plugin.app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(taskFile);
		plugin.app.workspace.getActiveFile = jest.fn().mockReturnValue(null);
		plugin.app.fileManager.generateMarkdownLink = jest
			.fn()
			.mockImplementation((_file, _sourcePath, _subpath, alias) =>
				`[[review Q2 with Sam|${alias}]]`
			);

		(plugin as any).handleInlineTaskCreated(
			{
				id: taskFile.path,
				path: taskFile.path,
				title: "review [[Projects/Q2|Q2]] with [Sam](People/Sam.md)",
				status: "open",
				priority: "normal",
				archived: false,
			} as TaskInfo,
			{ editor, insertionPoint: { line: 0, ch: 0 } }
		);

		expect(plugin.app.fileManager.generateMarkdownLink).toHaveBeenCalledWith(
			taskFile,
			"",
			"",
			"review Q2 with Sam"
		);
	});
});
