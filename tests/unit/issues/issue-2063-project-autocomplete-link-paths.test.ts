import { createCompletionPlugin, createMarkdownFile, getCompletionResult } from "../helpers/nlpCompletionTestUtils";
import { NLPSuggest } from "../../../src/modals/taskCreationSuggest";
import { MockObsidian } from "../../helpers/obsidian-runtime";

describe("Issue #2063: project autocomplete stores unambiguous link paths", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	function createPluginWithAmbiguousProjects() {
		const plugin = createCompletionPlugin({
			settings: {
				projectAutosuggest: {
					includeFolders: ["_codex/issue-2063/foo"],
					rows: ["{file.path|n(Path)|s}"],
				},
				storeTitleInFilename: false,
			},
		});

		createMarkdownFile("_codex/issue-2063/foo/baz.md", {});
		createMarkdownFile("_codex/issue-2063/bar/baz.md", {});

		(plugin.app.metadataCache as unknown as { fileToLinktext: jest.Mock }).fileToLinktext =
			jest.fn((file: { path: string }) => file.path.replace(/\.md$/u, ""));

		return plugin;
	}

	it("applies the selected project file path in CodeMirror task creation autocomplete", async () => {
		const plugin = createPluginWithAmbiguousProjects();

		const result = await getCompletionResult(plugin, "Codex smoke +ba");

		expect(result?.options).toHaveLength(1);
		expect(result?.options[0].apply).toBe("[[_codex/issue-2063/foo/baz]] ");
	});

	it("inserts the selected project file path in legacy textarea autocomplete", async () => {
		const plugin = createPluginWithAmbiguousProjects();
		const textarea = document.createElement("textarea");
		textarea.value = "Codex smoke +ba";
		textarea.setSelectionRange(textarea.value.length, textarea.value.length);

		const suggest = new NLPSuggest(plugin.app as never, textarea, plugin as never);
		const suggestions = await (suggest as unknown as {
			getProjectSuggestions(query: string): Promise<Array<{ type: "project" }>>;
			currentTrigger: "+" | null;
			selectSuggestion(suggestion: { type: "project" }): void;
		}).getProjectSuggestions("ba");

		expect(suggestions).toHaveLength(1);

		(suggest as unknown as { currentTrigger: "+" | null }).currentTrigger = "+";
		(suggest as unknown as { selectSuggestion(suggestion: { type: "project" }): void }).selectSuggestion(
			suggestions[0]
		);

		expect(textarea.value).toBe("Codex smoke +[[_codex/issue-2063/foo/baz]] ");
	});
});
