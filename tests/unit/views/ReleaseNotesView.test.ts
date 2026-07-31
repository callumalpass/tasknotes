import { MarkdownRenderer } from "obsidian";
import { ReleaseNotesView, transformReleaseNoteIssueLinks } from "../../../src/views/ReleaseNotesView";
import type { ReleaseNoteVersion } from "../../../src/releaseNotes";

describe("transformReleaseNoteIssueLinks", () => {
	it("links a single parenthesized issue reference", () => {
		const input = "- (#1720) Fixed something";
		const output = transformReleaseNoteIssueLinks(input);

		expect(output).toBe(
			"- ([#1720](https://github.com/callumalpass/tasknotes/issues/1720)) Fixed something"
		);
	});

	it("links comma-separated references inside one set of parentheses", () => {
		const input = "- (#1619, #386, #621) Added drag-to-reorder";
		const output = transformReleaseNoteIssueLinks(input);

		expect(output).toBe(
			"- ([#1619](https://github.com/callumalpass/tasknotes/issues/1619), [#386](https://github.com/callumalpass/tasknotes/issues/386), [#621](https://github.com/callumalpass/tasknotes/issues/621)) Added drag-to-reorder"
		);
	});

	it("leaves non-parenthesized hash references alone", () => {
		const input = "- Thanks to @ac8318740 for the original contribution in PR #1619";
		const output = transformReleaseNoteIssueLinks(input);

		expect(output).toBe(input);
	});
});

describe("ReleaseNotesView", () => {
	const createView = () =>
		new ReleaseNotesView(
			{} as never,
			{
				app: {},
				i18n: {
					translate: (key: string) =>
						key === "views.releaseNotes.baseFilesNotice" ? "Base files notice" : key,
				},
			} as never,
			[],
			"4.10.2"
		);

	const releaseNote = (overrides: Partial<ReleaseNoteVersion> = {}): ReleaseNoteVersion => ({
		version: "4.10.1",
		content: "Release content",
		date: null,
		isCurrent: false,
		...overrides,
	});

	const createSection = async (versionData: ReleaseNoteVersion, isExpanded: boolean) => {
		const view = createView();
		const container = document.createElement("div");
		await (view as unknown as {
			createVersionSection: (
				container: HTMLElement,
				versionData: ReleaseNoteVersion,
				isExpanded: boolean
			) => Promise<void>;
		}).createVersionSection(container, versionData, isExpanded);
		return container;
	};

	const flushPromises = async () => {
		await Promise.resolve();
		await Promise.resolve();
	};

	beforeEach(() => {
		jest.mocked(MarkdownRenderer.render).mockClear();
	});

	it("renders initially expanded release notes immediately", async () => {
		const container = await createSection(releaseNote(), true);

		expect(MarkdownRenderer.render).toHaveBeenCalledTimes(1);
		expect(container.querySelector(".release-notes-version-content")?.textContent).toBe(
			"Release content"
		);
	});

	it("defers collapsed release note rendering until first expansion", async () => {
		const container = await createSection(releaseNote(), false);

		expect(MarkdownRenderer.render).not.toHaveBeenCalled();
		expect(container.querySelector(".release-notes-version-content")?.textContent).toBe("");

		container.querySelector<HTMLElement>(".release-notes-version-header")?.click();
		await flushPromises();

		expect(MarkdownRenderer.render).toHaveBeenCalledTimes(1);
		expect(container.querySelector(".release-notes-version-content")?.textContent).toBe(
			"Release content"
		);
	});

	it("does not render the same release notes more than once", async () => {
		const container = await createSection(releaseNote(), false);
		const header = container.querySelector<HTMLElement>(".release-notes-version-header");

		header?.click();
		await flushPromises();
		header?.click();
		header?.click();
		await flushPromises();

		expect(MarkdownRenderer.render).toHaveBeenCalledTimes(1);
	});
});
