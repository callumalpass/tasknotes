import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #1909: compact task-card indicator sizing", () => {
	it("keeps compact primary indicators smaller than coarse-pointer touch targets", () => {
		const css = readRepoFile("styles/task-card-bem.css");

		const compactStatusSelector =
			".tasknotes-plugin .task-card--layout-compact .task-card__status-dot";
		const compactPrioritySelector =
			".tasknotes-plugin .task-card--layout-compact .task-card__priority-dot";
		const coarsePointerRule = css.indexOf("@media (pointer: coarse)");

		expect(coarsePointerRule).toBeGreaterThan(-1);
		expect(css.indexOf(compactStatusSelector)).toBeGreaterThan(coarsePointerRule);
		expect(css.indexOf(compactPrioritySelector)).toBeGreaterThan(coarsePointerRule);

		expect(css).toMatch(
			/\.tasknotes-plugin \.task-card--layout-compact \.task-card__status-dot\s*\{[^}]*width:\s*14px;[^}]*height:\s*14px;[^}]*min-width:\s*14px;[^}]*min-height:\s*14px;/s
		);
		expect(css).toMatch(
			/\.tasknotes-plugin \.task-card--layout-compact \.task-card__status-dot--icon svg\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;/s
		);
		expect(css).toMatch(
			/\.tasknotes-plugin \.task-card--layout-compact \.task-card__priority-dot\s*\{[^}]*display:\s*inline-block;[^}]*width:\s*9px;[^}]*height:\s*9px;[^}]*min-width:\s*9px;[^}]*min-height:\s*9px;/s
		);
		expect(css).toMatch(
			/\.tasknotes-plugin \.task-card--layout-compact \.task-card__priority-dot--icon\s*\{[^}]*display:\s*inline-flex;[^}]*width:\s*16px;[^}]*height:\s*16px;[^}]*min-width:\s*16px;[^}]*min-height:\s*16px;/s
		);
	});
});
