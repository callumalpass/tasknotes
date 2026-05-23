import fs from "fs";
import path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
	return match?.[1] ?? "";
}

describe("Issue #1934: custom priority colors in TaskCards", () => {
	it("lets custom per-card priority colors win over default priority fallback classes", () => {
		const css = readRepoFile("styles/task-card-bem.css");

		for (const priority of ["high", "medium", "normal", "low"]) {
			const block = extractCssBlock(
				css,
				`.tasknotes-plugin .task-card--priority-${priority} > .task-card__main-row .task-card__priority-dot`
			);

			expect(block).toContain(
				"background-color: var(--current-priority-color, var(--priority-color,"
			);
		}
	});
});
