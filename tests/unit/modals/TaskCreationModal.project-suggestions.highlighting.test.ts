import { renderProjectCompletionMetadata } from "../../../src/editor/NLPCodeMirrorAutocomplete";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import {
	createCompletionPlugin,
	createMarkdownFile,
	getCompletionResult,
} from "../helpers/nlpCompletionTestUtils";

describe("TaskCreationModal project autocomplete highlighting", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("wraps matching query text in searchable project metadata rows", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				projectAutosuggest: {
					rows: ["{title|n(Title)}", "{file.path|n(Path)|s}"],
				},
				storeTitleInFilename: false,
			},
		});
		createMarkdownFile("Work/Plan.md", {
			title: "Work Plan",
			aliases: ["P"],
		});

		const result = await getCompletionResult(plugin, "+pla");
		const rendered = renderProjectCompletionMetadata(result?.options[0] as never);
		const marks = Array.from(rendered?.querySelectorAll("mark") ?? []);

		expect(marks.map((mark) => mark.textContent?.toLowerCase())).toContain("pla");
		expect(rendered?.textContent).toContain("Work Plan");
		expect(rendered?.textContent).toContain("Work/Plan.md");
	});
});
