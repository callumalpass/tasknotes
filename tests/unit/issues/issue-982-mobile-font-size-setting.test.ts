import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

describe("Issue #982: Obsidian text font size inheritance", () => {
	it("derives TaskNotes typography tokens from Obsidian's text font size setting", () => {
		const css = readRepoFile("styles/tokens.css");

		expect(css).toContain("--tn-type-base: var(--font-text-size, 16px)");
		expect(css).toContain("--tn-type-2xs: calc(var(--tn-type-base) * 0.6875)");
		expect(css).toContain("--tn-type-xs: calc(var(--tn-type-base) * 0.75)");
		expect(css).toContain("--tn-type-sm: calc(var(--tn-type-base) * 0.8125)");
		expect(css).toContain("--tn-type-lg: calc(var(--tn-type-base) * 1.125)");
	});

	it("keeps mobile task cards tied to the Obsidian text size instead of compact desktop tokens", () => {
		const css = readRepoFile("styles/task-card-bem.css");

		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\) \.task-card__title\s*\{[^}]*font-size:\s*var\(--tn-type-base\);/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\) \.task-card__metadata\s*\{[^}]*font-size:\s*max\(var\(--tn-type-sm\),\s*var\(--font-ui-small,\s*var\(--tn-type-sm\)\)\);/s
		);
	});
});
