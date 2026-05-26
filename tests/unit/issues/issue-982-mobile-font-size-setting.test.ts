import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

describe("Issue #982: Obsidian text font size inheritance", () => {
	it("derives TaskNotes typography tokens from Obsidian's text font size setting", () => {
		const css = readRepoFile("styles/variables.css");

		expect(css).toContain("--tn-font-size-base: var(--font-text-size, 16px)");
		expect(css).toContain("--tn-font-size-xs: calc(var(--tn-font-size-base) * 0.625)");
		expect(css).toContain("--tn-font-size-md: calc(var(--tn-font-size-base) * 0.75)");
		expect(css).toContain("--tn-font-size-lg: calc(var(--tn-font-size-base) * 0.875)");
		expect(css).toContain("--tn-font-size-2xl: calc(var(--tn-font-size-base) * 1.125)");
	});

	it("keeps mobile task cards tied to the Obsidian text size instead of compact desktop tokens", () => {
		const css = readRepoFile("styles/task-card-bem.css");

		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\) \.task-card__title\s*\{[^}]*font-size:\s*var\(--tn-font-size-base\);/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\) \.task-card__metadata\s*\{[^}]*font-size:\s*max\(var\(--tn-font-size-lg\),\s*var\(--font-ui-small,\s*13px\)\);/s
		);
	});
});
