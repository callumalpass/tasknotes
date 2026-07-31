import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #1985: embedded Calendar time-grid alignment", () => {
	it("prevents markdown table spacing from shifting FullCalendar timed events", () => {
		const css = readRepoFile("styles/advanced-calendar-view.css");

		expect(css).toMatch(
			/\.advanced-calendar-view \.fc-timegrid-cols table\s*\{[^}]*margin:\s*0;[^}]*\}/s
		);
		expect(css).toMatch(
			/\.advanced-calendar-view \.fc-timegrid-cols \.fc-timegrid-col\s*\{[^}]*padding:\s*0;[^}]*\}/s
		);
	});
});
