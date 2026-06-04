import fs from "fs";
import path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
	return match?.[1] ?? "";
}

describe("Issue #1966: priority icon backgrounds", () => {
	it("keeps priority icon indicators transparent after data-priority color rules", () => {
		const css = readRepoFile("styles/task-card-bem.css");
		const colorSelector =
			".tasknotes-plugin .task-card[data-priority] > .task-card__main-row .task-card__priority-dot";
		const iconSelector =
			".tasknotes-plugin .task-card[data-priority] > .task-card__main-row .task-card__priority-dot--icon";

		const colorRuleIndex = css.indexOf(colorSelector);
		const iconRuleIndex = css.indexOf(iconSelector);

		expect(colorRuleIndex).toBeGreaterThanOrEqual(0);
		expect(iconRuleIndex).toBeGreaterThan(colorRuleIndex);
		expect(extractCssBlock(css, iconSelector)).toContain("background-color: transparent");
	});
});
