import * as fs from "fs";
import * as path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

describe("Issue #1075: WebKit native date labels", () => {
	it("hides the generated WebKit date label inside TaskNotes date fields", () => {
		const css = readRepoFile("styles/date-picker.css");

		expect(css).toContain(
			'.tasknotes-plugin input[type="date"]::-webkit-datetime-edit-label'
		);
		expect(css).toMatch(
			/\.tasknotes-plugin input\[type="date"\]::-webkit-datetime-edit-label\s*\{[^}]*display:\s*none;/
		);
	});
});
