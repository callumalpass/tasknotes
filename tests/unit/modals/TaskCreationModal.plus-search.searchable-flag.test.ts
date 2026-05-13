import { MockObsidian } from "../../__mocks__/obsidian";
import {
	createCompletionPlugin,
	createMarkdownFile,
	getCompletionResult,
} from "../helpers/nlpCompletionTestUtils";

describe("+ project autocomplete searchable fields", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("always searches basename, title, and aliases", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				projectAutosuggest: {
					rows: ["{customer|n(Customer)}"],
				},
				storeTitleInFilename: false,
			},
		});
		createMarkdownFile("Projects/AcmePlan.md", {});
		createMarkdownFile("Projects/TitleOnly.md", { title: "Foobar rollout" });
		createMarkdownFile("Projects/AliasOnly.md", { aliases: ["Sidequest"] });

		await expect(getCompletionResult(plugin, "+acme")).resolves.toMatchObject({
			options: [expect.objectContaining({ apply: "[[AcmePlan]] " })],
		});
		await expect(getCompletionResult(plugin, "+foobar")).resolves.toMatchObject({
			options: [expect.objectContaining({ apply: "[[TitleOnly]] " })],
		});
		await expect(getCompletionResult(plugin, "+side")).resolves.toMatchObject({
			options: [expect.objectContaining({ apply: "[[AliasOnly]] " })],
		});
	});

	it("only searches file.path when that displayed field is flagged with |s", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				projectAutosuggest: {
					rows: ["{title|n(Title)}", "{file.path|n(Path)}"],
				},
				storeTitleInFilename: false,
			},
		});
		createMarkdownFile("Clients/Acme/Project.md", {
			title: "Implementation",
			customer: "Northwind",
		});

		await expect(getCompletionResult(plugin, "+acme")).resolves.toBeNull();

		plugin.settings.projectAutosuggest.rows = [
			"{title|n(Title)}",
			"{file.path|n(Path)|s}",
		];
		await expect(getCompletionResult(plugin, "+acme")).resolves.toMatchObject({
			options: [expect.objectContaining({ apply: "[[Project]] " })],
		});
	});

	it("searches custom frontmatter fields only when they are flagged with |s", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				projectAutosuggest: {
					rows: ["{title|n(Title)}", "{customer|n(Customer)}"],
				},
				storeTitleInFilename: false,
			},
		});
		createMarkdownFile("Clients/Project.md", {
			title: "Implementation",
			customer: "Acme Corp",
		});

		await expect(getCompletionResult(plugin, "+acme")).resolves.toBeNull();

		plugin.settings.projectAutosuggest.rows = [
			"{title|n(Title)}",
			"{customer|n(Customer)|s}",
		];
		await expect(getCompletionResult(plugin, "+acme")).resolves.toMatchObject({
			options: [expect.objectContaining({ apply: "[[Project]] " })],
		});
	});
});
