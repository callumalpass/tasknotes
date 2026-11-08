import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #1947: mobile left-chevron task cards", () => {
	it("keeps the left subtask chevron visible and badges on the main row", () => {
		const css = readRepoFile("styles/task-card-bem.css");

		const narrow = css.slice(css.indexOf("Stacked card layout at every width"));
		expect(narrow).toMatch(
			// Out of the badge row and into the reserved left gutter, level with the status
			/\.task-card\.task-card--chevron-left:not\(\.task-card--layout-inline\) \.task-card__badges \.task-card__chevron\s*\{[^}]*position:\s*absolute;[^}]*left:\s*calc\(-1 \*[^}]*top:\s*0;[^}]*transform:\s*none;/s
		);
		expect(narrow).toMatch(/\.task-card__badges\s*\{[^}]*grid-column:\s*4;[^}]*grid-row:\s*2;[^}]*flex-wrap:\s*nowrap;/s);
		expect(narrow).toMatch(/\.task-card__status-dot\s*\{[^}]*grid-column:\s*1;/s);
	});
});
