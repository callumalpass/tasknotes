import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

describe("Issue #983: Agenda sidebar responsive layout", () => {
	it("marks list-mode calendar views so agenda-specific responsive CSS can apply", () => {
		const source = readRepoFile("src/bases/CalendarView.ts");

		expect(source).toContain('calendarView.startsWith("list")');
		expect(source).toContain('"advanced-calendar-view--list"');
		expect(source).toContain('"advanced-calendar-view__calendar--list"');
	});
});
