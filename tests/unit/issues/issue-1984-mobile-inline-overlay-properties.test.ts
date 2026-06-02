import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #1984: mobile inline task overlay properties", () => {
	it("keeps configured inline metadata visible on Obsidian mobile", () => {
		const css = readRepoFile("styles/task-card-bem.css");

		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card--layout-inline \.task-card__metadata\s*\{[^}]*display:\s*inline-flex;[^}]*max-width:\s*min\(52vw,\s*24em\);[^}]*overflow-x:\s*auto;/s
		);
		expect(css).not.toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card--layout-inline \.task-card__metadata\s*\{[^}]*display:\s*none;/s
		);
	});
});
