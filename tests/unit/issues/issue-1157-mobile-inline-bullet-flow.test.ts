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
		const css = readRepoFile("styles/task-card-bem.css");
		const mobileInlineRule = readRule(
			css,
			"body.is-mobile .tasknotes-plugin .task-card--layout-inline"
		);
		const mobileInlineInnerRule = readRule(
			css,
			"body.is-mobile .tasknotes-plugin .task-card--layout-inline .task-card__main-row,\nbody.is-mobile .tasknotes-plugin .task-card--layout-inline .task-card__content"
		);

		expect(mobileInlineRule).toMatch(/display:\s*inline;/);
		expect(mobileInlineRule).not.toMatch(/display:\s*inline-flex;/);
		expect(mobileInlineRule).toMatch(/white-space:\s*normal;/);
		expect(mobileInlineRule).toMatch(/vertical-align:\s*baseline;/);
		expect(mobileInlineInnerRule).toMatch(/display:\s*inline;/);
		const titleRule = readRule(css, "body.is-mobile .tasknotes-plugin .task-card--layout-inline .task-card__title-text");
		expect(mobileInlineRule).toContain("--tn-mobile-inline-title-reserve: calc(2 * var(--tn-mobile-inline-indicator-size) + var(--tn-mobile-inline-menu-size) + 0.85em)");
		expect(titleRule).toContain("max-width: max(0px, calc(100% - var(--tn-mobile-inline-title-reserve)))");
		expect(titleRule).toMatch(/display:\s*inline-block;/);
		expect(titleRule).toMatch(/white-space:\s*nowrap;/);
		expect(titleRule).not.toMatch(/\d+(vw|em)/);
	});
});
