import {
	renderProjectCompletionMetadata,
	type ProjectCompletionMetadata,
} from "../../../src/editor/NLPCodeMirrorAutocomplete";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import {
	createCompletionPlugin,
	createMarkdownFile,
	getCompletionResult,
} from "../helpers/nlpCompletionTestUtils";

describe("TaskCreationModal project autocomplete metadata rendering", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("builds CodeMirror project completions with configured metadata rows", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				projectAutosuggest: {
					rows: [
						"{title|n(Title)}",
						"{aliases|n(Aliases)}",
						"{file.path|n(Path)}",
					],
				},
				storeTitleInFilename: false,
			},
		});
		createMarkdownFile("Work/Plan.md", {
			title: "Work Plan",
			aliases: ["P"],
		});

		const result = await getCompletionResult(plugin, "+pla");
		expect(result?.from).toBe(1);

		const completion = result?.options[0] as
			| {
					label: string;
					apply: string;
					info: string;
					projectMetadata?: ProjectCompletionMetadata;
			  }
			| undefined;

		expect(completion?.label).toContain("Plan");
		expect(completion?.apply).toBe("[[Plan]] ");
		expect(completion?.info).toBe("Project");
		expect(completion?.projectMetadata).toHaveLength(3);

		const rendered = renderProjectCompletionMetadata(completion as never);
		expect(rendered?.querySelectorAll(".cm-project-suggestion__meta")).toHaveLength(3);
		expect(rendered?.textContent).toContain("Title: Work Plan");
		expect(rendered?.textContent).toContain("Aliases: P");
		expect(rendered?.textContent).toContain("Path: Work/Plan.md");
	});
});
