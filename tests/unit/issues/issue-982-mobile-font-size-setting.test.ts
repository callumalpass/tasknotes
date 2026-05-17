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
});
