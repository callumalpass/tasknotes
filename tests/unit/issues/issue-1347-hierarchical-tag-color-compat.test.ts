/**
 * Issue #1347: TaskNotes tag styling should not outrank tag-color plugins.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1347
 */

import fs from "fs";
import path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

describe("Issue #1347: hierarchical tag color compatibility", () => {
	it("uses low-specificity task-card tag selectors so href-based tag coloring can win", () => {
		const css = readRepoFile("styles/task-card-bem.css");

		expect(css).toContain(".tasknotes-plugin .task-card__metadata-property :where(.tag)");
		expect(css).toContain(
			".tasknotes-plugin .task-card__metadata-property :where(.tag:hover)"
		);
		expect(css).not.toContain(".tasknotes-plugin .task-card__metadata-property .tag {");
		expect(css).not.toContain(
			".tasknotes-plugin .task-card__metadata-property .tag:hover"
		);
	});
});
