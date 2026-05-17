/**
 * Issue #933: allow non-Markdown files to be suggested as task projects.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/933
 */

import { parseFrontMatterAliases, type TFile } from "obsidian";
import type TaskNotesPlugin from "../../../src/main";
import { FileSuggestHelper } from "../../../src/suggest/FileSuggestHelper";

jest.mock("obsidian", () => ({
	...jest.requireActual("obsidian"),
	parseFrontMatterAliases: jest.fn((frontmatter: Record<string, unknown>) => {
		const aliases = frontmatter?.aliases;
		if (!aliases) return [];
		return Array.isArray(aliases) ? aliases : [aliases];
	}),
}));

function createFile(path: string, extension: string): TFile {
	const name = path.split("/").pop() || path;
	const basename = name.endsWith(`.${extension}`)
		? name.slice(0, -extension.length - 1)
		: name;

	return {
		basename,
		name,
		path,
		extension,
		parent: { path: path.split("/").slice(0, -1).join("/") },
	} as TFile;
}

function createPlugin(files: TFile[]): TaskNotesPlugin {
	const markdownFiles = files.filter((file) => file.extension === "md");

	return {
		app: {
			vault: {
				getFiles: jest.fn(() => files),
				getMarkdownFiles: jest.fn(() => markdownFiles),
			},
			metadataCache: {
				getFileCache: jest.fn((file: TFile) => ({
					frontmatter:
						file.extension === "md"
							? { aliases: [`${file.basename} Alias`] }
							: undefined,
					tags: [],
				})),
			},
		},
		settings: {
			excludedFolders: "",
			projectAutosuggest: { rows: [] },
			suggestionDebounceMs: 0,
			storeTitleInFilename: false,
		},
		fieldMapper: {
			mapFromFrontmatter: jest.fn(() => ({ title: "" })),
		},
	} as unknown as TaskNotesPlugin;
}

describe("Issue #933: non-Markdown files as projects", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("suggests canvas files alongside Markdown files", async () => {
		const files = [
			createFile("projects/Project Alpha.md", "md"),
			createFile("projects/Canvas Project.canvas", "canvas"),
			createFile("projects/Design Board.canvas", "canvas"),
		];
		const plugin = createPlugin(files);

		const results = await FileSuggestHelper.suggest(plugin, "project");

		expect(plugin.app.vault.getFiles).toHaveBeenCalled();
		expect(results.map((result) => result.insertText)).toEqual(
			expect.arrayContaining(["Project Alpha", "Canvas Project.canvas"])
		);
	});

	it("matches non-Markdown project suggestions by basename", async () => {
		const files = [
			createFile("projects/Project Alpha.md", "md"),
			createFile("projects/Design Board.canvas", "canvas"),
		];
		const plugin = createPlugin(files);

		const results = await FileSuggestHelper.suggest(plugin, "Design");

		expect(results.map((result) => result.insertText)).toEqual(["Design Board.canvas"]);
		expect(results[0].displayText).toBe("Design Board");
	});

	it("keeps Markdown suggestions as basename-only link targets", async () => {
		const files = [
			createFile("projects/Project Alpha.md", "md"),
			createFile("projects/Canvas Project.canvas", "canvas"),
		];
		const plugin = createPlugin(files);

		const results = await FileSuggestHelper.suggest(plugin, "Alpha");

		expect(results.map((result) => result.insertText)).toEqual(["Project Alpha"]);
		expect(parseFrontMatterAliases).toHaveBeenCalled();
	});
});
