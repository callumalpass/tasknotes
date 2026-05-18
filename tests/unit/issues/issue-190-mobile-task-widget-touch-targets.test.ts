import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #190: mobile task widget touch targets", () => {
	it("keeps task-card action controls visible and larger on Obsidian mobile", () => {
		const css = readRepoFile("styles/task-card-bem.css");

		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card__context-menu\s*\{[^}]*min-width:\s*36px;[^}]*min-height:\s*36px;[^}]*opacity:\s*1;/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card--layout-inline \.task-card__priority-dot\s*\{[^}]*width:\s*28px;[^}]*height:\s*28px;[^}]*background-clip:\s*content-box;/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card--layout-inline \.task-card__context-menu\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*opacity:\s*1;/s
		);
	});

	it("applies the same inline task-link hardening on coarse pointer devices", () => {
		const css = readRepoFile("styles/task-card-bem.css");

		expect(css).toContain("@media (pointer: coarse)");
		expect(css).toMatch(
			/@media \(pointer: coarse\)\s*\{[\s\S]*\.tasknotes-plugin \.task-card--layout-inline \.task-card__priority-dot\s*\{[^}]*width:\s*28px;[^}]*height:\s*28px;[^}]*background-clip:\s*content-box;/s
		);
		expect(css).toMatch(
			/@media \(pointer: coarse\)\s*\{[\s\S]*\.tasknotes-plugin \.task-card--layout-inline \.task-card__context-menu\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*opacity:\s*1;/s
		);
	});
});
