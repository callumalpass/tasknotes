/**
 * Issue #1234: right-aligned subtask chevrons should remain visible when a
 * task has subtasks, matching the left-aligned chevron behavior.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1234
 */

import * as fs from "fs";
import * as path from "path";

const cssFilePath = path.resolve(__dirname, "../../../styles/task-card-bem.css");

describe("Issue #1234: right-aligned subtask chevron visibility", () => {
	it("keeps the base chevron visible for right-aligned task cards", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const chevronBlock = extractCssBlock(
			cssContent,
			".tasknotes-plugin .task-card__chevron"
		);

		expect(chevronBlock).toContain("opacity: 1");
		expect(chevronBlock).not.toContain("opacity: 0");
	});

	it("preserves the left-aligned chevron gutter positioning", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const leftChevronBlock = extractCssBlock(
			cssContent,
			".tasknotes-plugin .task-card.task-card--chevron-left .task-card__chevron"
		);

		expect(leftChevronBlock).toContain("opacity: 1");
		expect(leftChevronBlock).toContain("position: absolute");
		expect(leftChevronBlock).toContain("left: calc(-1 * var(--tn-spacing-lg) - 14px)");
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}
