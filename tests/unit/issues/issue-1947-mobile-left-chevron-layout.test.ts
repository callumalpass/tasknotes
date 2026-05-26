import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #1947: mobile left-chevron task cards", () => {
	it("keeps the left subtask chevron visible and badges on the main row", () => {
		const css = readRepoFile("styles/task-card-bem.css");

		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card\.task-card--chevron-left \.task-card__chevron\s*\{[^}]*left:\s*var\(--tn-spacing-xs\);[^}]*width:\s*32px;[^}]*height:\s*32px;/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card\.task-card--chevron-left:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\)\s*\{[^}]*padding-left:\s*calc\(var\(--tn-mobile-task-card-menu-size\) \+ var\(--tn-spacing-sm\)\);/s
		);
		expect(css).not.toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card\.task-card--chevron-left:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\)\s*\{[^}]*margin-left:/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card\.task-card--chevron-left:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\) \.task-card__badges\s*\{[^}]*order:\s*0;[^}]*flex:\s*0 0 auto;[^}]*padding-left:\s*0;/s
		);
	});
});
