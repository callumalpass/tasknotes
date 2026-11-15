/**
 * Issue #1904: long tags in task cards should wrap instead of forcing
 * horizontal scrolling in Bases views and embedded note cards.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1904
 */

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

describe("Issue #1904: task card long tag wrapping", () => {
	it("keeps long tags atomic and moves overflow into a counted summary instead of horizontal scrolling", () => {
		const css = readRepoFile("styles/task-card-bem.css");
		const stackedCss = css.slice(css.indexOf("@container tn-task-card (max-width: 480px)", css.indexOf(".tasknotes-plugin .task-card__metadata-property--tags")));
		const tagsPropertyBlock = extractCssBlock(stackedCss, ".tasknotes-plugin .task-card__metadata-property--tags");
		const tagBlock = extractCssBlock(
			css,
			".tasknotes-plugin .task-card__metadata-property--tags :where(.tag)"
		);

		expect(tagsPropertyBlock).toContain("flex-wrap: nowrap");
		expect(tagsPropertyBlock).toContain("align-items: flex-start");
		expect(tagBlock).toContain("flex: none");
		expect(tagBlock).toContain("min-width: 0");
		expect(tagBlock).toContain("max-width: none");
		expect(tagBlock).toContain("overflow-wrap: normal");
		expect(tagBlock).toContain("word-break: normal");
		const valuesBlock = extractCssBlock(css, ".tasknotes-plugin .task-card__metadata-values");
		expect(valuesBlock).toContain("min-width: 0");
		expect(valuesBlock).toContain("overflow: hidden");
		const renderer = readRepoFile("src/ui/taskCardMetadata.ts");
		expect(renderer).toContain('cls: "task-card__metadata-overflow"');
		expect(renderer).toContain('setTooltip(summary, label');
		expect(renderer).toContain('atom.hidden = true');
	});
});
