import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
	return match?.[1] ?? "";
}

function extractLastCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const matches = Array.from(css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g")));
	return matches.at(-1)?.[1] ?? "";
}

describe("Issue #2194: Pomodoro task selector card width", () => {
	it("keeps rich task-card suggestions from collapsing into one-character title columns", () => {
		const css = readRepoFile("styles/task-selector-with-create-modal.css");
		const promptBlock = extractCssBlock(css, ".task-selector-with-create-modal .prompt");
		const suggestionContainerBlock = extractCssBlock(
			css,
			".task-selector-with-create-modal .suggestion-container"
		);
		const suggestionItemBlock = extractCssBlock(
			css,
			".task-selector-with-create-modal .suggestion-item"
		);
		const taskCardBlock = extractCssBlock(css, ".task-selector-with-create-modal .task-card");
		const flexChildBlock =
			css.match(
				/\.task-selector-with-create-modal \.task-card__main-row,\s*\.task-selector-with-create-modal \.task-card__content,\s*\.task-selector-with-create-modal \.task-card__title,\s*\.task-selector-with-create-modal \.task-card__title-text\s*\{([^}]*)\}/s
			)?.[1] ?? "";
		const titleTextBlock = extractCssBlock(
			css,
			".task-selector-with-create-modal .task-card__title-text"
		);
		const finalTitleTextBlock = extractLastCssBlock(
			css,
			".task-selector-with-create-modal .task-card__title-text"
		);

		expect(promptBlock).toContain("width: min(720px, calc(100vw - 32px));");
		expect(promptBlock).toContain("max-width: calc(100vw - 32px);");
		expect(suggestionContainerBlock).toContain("width: 100%;");
		expect(suggestionItemBlock).toContain("width: 100%;");
		expect(suggestionItemBlock).toContain("min-width: 0;");
		expect(taskCardBlock).toContain("width: 100%;");
		expect(taskCardBlock).toContain("min-width: 0;");
		expect(taskCardBlock).toContain("max-width: 100%;");
		expect(flexChildBlock).toContain("min-width: 0;");
		expect(flexChildBlock).toContain("max-width: 100%;");
		expect(titleTextBlock).toContain("min-width: 0;");
		expect(finalTitleTextBlock).toContain("word-break: normal;");
		expect(finalTitleTextBlock).toContain("overflow-wrap: anywhere;");
	});
});
