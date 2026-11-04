import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readRule(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`(?:^|\\n\\n)${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`, "s"));
	if (!match?.groups?.body) {
		throw new Error(`Missing CSS rule for ${selector}`);
	}
	return match.groups.body;
}

describe("Issue #1157: mobile inline task cards in markdown bullets", () => {
	it("keeps the mobile inline card wrapper in text flow inside list items", () => {
		const css = readRepoFile("styles/task-inline-widget.css");
		const inlineRule = readRule(css, ".tasknotes-plugin .task-card--layout-inline");
		const contentRule = readRule(css, ".tasknotes-plugin .task-card--layout-inline .task-card__main-row,\n.tasknotes-plugin .task-card--layout-inline .task-card__content");
		expect(inlineRule).toMatch(/display:\s*inline-flex;/);
		expect(inlineRule).toContain("max-width: calc(100% - 1ch)");
		expect(inlineRule).toMatch(/vertical-align:\s*middle;/);
		expect(contentRule).toMatch(/display:\s*inline-flex;/);
		expect(contentRule).toMatch(/flex-wrap:\s*nowrap;/);
		expect(contentRule).toMatch(/min-width:\s*0;/);
		expect(css).toMatch(/\.task-card--layout-inline \.task-card__title,[\s\S]*?text-overflow:\s*ellipsis;/);
	});
});
