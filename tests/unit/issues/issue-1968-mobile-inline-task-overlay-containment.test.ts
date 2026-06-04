import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #1968: mobile inline task overlay containment", () => {
	it("keeps card container queries off inline task overlays", () => {
		const css = readRepoFile("styles/task-card-bem.css");

		expect(css).toMatch(
			/\.tasknotes-plugin \.task-card\s*\{[^}]*container:\s*tn-task-card \/ inline-size;/s
		);
		expect(css).toMatch(
			/\.tasknotes-plugin \.task-card--layout-inline\s*\{[^}]*container-type:\s*normal;[^}]*container-name:\s*none;/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card--layout-inline\s*\{[^}]*display:\s*inline-flex;[^}]*max-width:\s*100%;/s
		);
	});
});
