import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import { getMarkdownEditorTooltipParent } from "../../../src/editor/EmbeddableMarkdownEditor";
import { renderProjectCompletionMetadata } from "../../../src/editor/NLPCodeMirrorAutocomplete";
import { MockObsidian } from "../../__mocks__/obsidian";
import {
	createCompletionPlugin,
	createMarkdownFile,
	getCompletionResult,
} from "../helpers/nlpCompletionTestUtils";

function createFileSuggestionNote(
	plugin: ReturnType<typeof createCompletionPlugin>,
	path: string,
	frontmatter: Record<string, unknown>
): void {
	createMarkdownFile(path, frontmatter);

	const metadataCache = plugin.app.metadataCache as {
		setCache(
			path: string,
			metadata: {
				frontmatter: Record<string, unknown>;
				tags: Array<{ tag: string }>;
			}
		): void;
	};
	const frontmatterTags = Array.isArray(frontmatter.tags)
		? frontmatter.tags.filter((tag): tag is string => typeof tag === "string")
		: [];

	metadataCache.setCache(path, {
		frontmatter,
		tags: frontmatterTags.map((tag) => ({ tag: `#${tag}` })),
	});
}

describe("Issue #1870: user field file autosuggest NLP values", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("parses wikilink values inserted by custom user field autocomplete triggers", () => {
		const parser = new NaturalLanguageParser(
			[],
			[],
			true,
			"en",
			{
				triggers: [{ propertyId: "reference", trigger: "/", enabled: true }],
			},
			[
				{
					id: "reference",
					displayName: "Reference",
					key: "reference",
					type: "text",
					autosuggestFilter: { requiredTags: ["reference"] },
				},
			]
		);

		const parsed = parser.parseInput("Follow up /[[Reference Note]]");

		expect(parsed.title).toBe("Follow up");
		expect(parsed.userFields).toEqual({
			reference: "[[Reference Note]]",
		});
	});

	it("parses multiple wikilink values for list user fields", () => {
		const parser = new NaturalLanguageParser(
			[],
			[],
			true,
			"en",
			{
				triggers: [{ propertyId: "references", trigger: "/", enabled: true }],
			},
			[
				{
					id: "references",
					displayName: "References",
					key: "references",
					type: "list",
					autosuggestFilter: { requiredTags: ["reference"] },
				},
			]
		);

		const parsed = parser.parseInput("Follow up /[[Reference Note]] /[[Second Note]]");

		expect(parsed.title).toBe("Follow up");
		expect(parsed.userFields).toEqual({
			references: ["[[Reference Note]]", "[[Second Note]]"],
		});
	});

	it("uses file suggestions for list user fields with autosuggest filters", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				nlpTriggers: {
					triggers: [{ propertyId: "references", trigger: "/", enabled: true }],
				},
				userFields: [
					{
						id: "references",
						displayName: "References",
						key: "references",
						type: "list",
						autosuggestFilter: { requiredTags: ["reference"] },
					},
				],
			},
		});

		createFileSuggestionNote(plugin, "References/Reference Note.md", {
			tags: ["reference"],
		});
		createFileSuggestionNote(plugin, "References/Other Note.md", { tags: ["other"] });

		await expect(getCompletionResult(plugin, "Follow up /ref")).resolves.toMatchObject({
			from: "Follow up /".length,
			options: [
				expect.objectContaining({
					label: "Reference Note",
					apply: "[[Reference Note]] ",
					info: "references",
				}),
			],
		});
	});

	it("mounts NLP autocomplete UI in the editor document for pop-out windows", () => {
		const popoutDocument = document.implementation.createHTMLDocument("TaskNotes popout");
		const container = popoutDocument.createElement("div");
		popoutDocument.body.appendChild(container);

		expect(getMarkdownEditorTooltipParent(container)).toBe(popoutDocument.body);
		expect(getMarkdownEditorTooltipParent(container)).not.toBe(document.body);

		const metadata = renderProjectCompletionMetadata(
			{
				label: "Reference Note",
				projectMetadata: [[{ text: "Reference Note", searchable: true, kind: "value" }]],
				projectQuery: "Reference",
			} as never,
			popoutDocument
		);

		expect(metadata?.ownerDocument).toBe(popoutDocument);
		expect(metadata?.querySelector("mark")?.ownerDocument).toBe(popoutDocument);
	});
});
