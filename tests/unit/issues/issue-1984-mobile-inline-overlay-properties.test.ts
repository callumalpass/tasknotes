import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #1984: mobile inline task overlay properties", () => {
	it("keeps configured inline metadata visible on Obsidian mobile", () => {
		const css = readRepoFile("styles/task-inline-widget.css");

		expect(css).toMatch(
			/\.tasknotes-plugin \.task-card--layout-inline \.task-card__metadata\s*\{[^}]*display:\s*inline-flex;[^}]*max-width:\s*12em;[^}]*min-width:\s*0;/s
		);
		expect(css).toContain(".task-card__metadata-values");
		expect(css).toContain("overflow-x: auto;");
		expect(css).toContain(".task-card__context-menu");
		expect(css).not.toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card--layout-inline \.task-card__metadata\s*\{[^}]*display:\s*none;/s
		);
	});
});
