import { transformReleaseNoteIssueLinks } from "../../../src/views/ReleaseNotesView";

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
