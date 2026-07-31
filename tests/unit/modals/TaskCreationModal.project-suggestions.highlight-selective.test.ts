import { renderProjectCompletionMetadata } from "../../../src/editor/NLPCodeMirrorAutocomplete";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import {
	createCompletionPlugin,
	createMarkdownFile,
	getCompletionResult,
} from "../helpers/nlpCompletionTestUtils";

async function renderFirstProjectCompletion(
	plugin: ReturnType<typeof createCompletionPlugin>,
	query: string
): Promise<HTMLElement> {
	const result = await getCompletionResult(plugin, query);
	expect(result?.options.length).toBeGreaterThan(0);
	const rendered = renderProjectCompletionMetadata(result?.options[0] as never);
	expect(rendered).toBeTruthy();
	return rendered as HTMLElement;
}

describe("Project autocomplete metadata highlighting selectivity", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("highlights |s metadata fields while leaving unflagged metadata unmarked", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				projectAutosuggest: {
					rows: ["{file.path|n(Path)}", "{tags|n(Tags)|s}"],
				},
				storeTitleInFilename: false,
			},
		});
		createMarkdownFile("Personal/Watch.md", {
			title: "Watch fantastic four",
			tags: ["tasks"],
		});

		const rendered = await renderFirstProjectCompletion(plugin, "+tas");
		const values = rendered.querySelectorAll(".cm-project-suggestion__meta-value");

		expect(values[0].textContent).toContain("Personal/Watch.md");
		expect(values[0].querySelector("mark")).toBeFalsy();
		expect(values[1].textContent).toContain("tasks");
		expect(values[1].querySelector("mark")?.textContent?.toLowerCase()).toBe("tas");
	});

	it("highlights title and aliases even without |s", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				projectAutosuggest: {
					rows: ["{title|n(Title)}", "{aliases|n(Aliases)}"],
				},
				storeTitleInFilename: false,
			},
		});
		createMarkdownFile("Projects/Plan.md", {
			title: "Tasks master",
			aliases: ["Tas alias"],
		});

		const rendered = await renderFirstProjectCompletion(plugin, "+tas");
		const values = Array.from(
			rendered.querySelectorAll(".cm-project-suggestion__meta-value")
		);

		expect(values).toHaveLength(2);
		expect(values.every((value) => value.querySelector("mark"))).toBe(true);
	});

	it("leaves project metadata unmarked when there is no project query", () => {
		const rendered = renderProjectCompletionMetadata({
			label: "Plan",
			apply: "[[Plan]] ",
			projectMetadata: [[{ text: "Task source", searchable: true, kind: "value" }]],
		} as never);

		expect(rendered?.textContent).toBe("Task source");
		expect(rendered?.querySelector("mark")).toBeFalsy();
	});

	it("highlights only the searchable token in a mixed metadata row", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				projectAutosuggest: {
					rows: ["{customer|n(Customer)|s} - {file.path|n(Path)}"],
				},
				storeTitleInFilename: false,
			},
		});
		createMarkdownFile("Work/Tas-demo.md", {
			title: "Demo",
			customer: "Tasco",
		});

		const rendered = await renderFirstProjectCompletion(plugin, "+tas");
		const values = rendered.querySelectorAll(".cm-project-suggestion__meta-value");

		expect(values[0].textContent).toContain("Tasco");
		expect(values[0].querySelector("mark")?.textContent?.toLowerCase()).toBe("tas");
		expect(values[1].textContent).toContain("Work/Tas-demo.md");
		expect(values[1].querySelector("mark")).toBeFalsy();
	});

	it("highlights inside joined array metadata values", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				projectAutosuggest: {
					rows: ["{aliases|n(Aliases)}"],
				},
				storeTitleInFilename: false,
			},
		});
		createMarkdownFile("Projects/Array-demo.md", {
			title: "Array demo",
			aliases: ["foo", "TasBar", "baz"],
		});

		const rendered = await renderFirstProjectCompletion(plugin, "+tas");
		const value = rendered.querySelector(".cm-project-suggestion__meta-value");

		expect(value?.textContent?.toLowerCase()).toContain("foo, tasbar, baz");
		expect(value?.querySelector("mark")?.textContent?.toLowerCase()).toBe("tas");
	});

	it("does not highlight unsearchable custom fields that happen to contain the query", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				projectAutosuggest: {
					rows: ["{customer|n(Customer)}"],
				},
				storeTitleInFilename: false,
			},
		});
		createMarkdownFile("Projects/Other.md", {
			title: "Task source",
			customer: "Tasco",
		});

		const rendered = await renderFirstProjectCompletion(plugin, "+tas");
		const value = rendered.querySelector(".cm-project-suggestion__meta-value");

		expect(value?.textContent).toBe("Tasco");
		expect(value?.querySelector("mark")).toBeFalsy();
	});
});
