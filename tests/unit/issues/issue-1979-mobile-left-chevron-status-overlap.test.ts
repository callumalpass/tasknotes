import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #1979: mobile left-chevron status overlap", () => {
	it("keeps the left subtask chevron in the reserved gutter instead of on top of the status indicator", () => {
		const css = readRepoFile("styles/task-card-bem.css");

		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card\.task-card--chevron-left \.task-card__chevron\s*\{[^}]*left:\s*calc\(-1 \* var\(--tn-mobile-task-card-menu-size\) - var\(--tn-spacing-xs\)\);/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card\.task-card--chevron-left:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\)\s*\{[^}]*padding-left:\s*calc\(var\(--tn-mobile-task-card-menu-size\) \+ var\(--tn-spacing-sm\)\);/s
		);
	});
});
