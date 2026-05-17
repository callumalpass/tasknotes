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

	it("uses container-width rules to wrap the agenda toolbar in narrow sidebars", () => {
		const css = readRepoFile("styles/advanced-calendar-view.css");

		expect(css).toContain("container-type: inline-size");
		expect(css).toContain("@container (max-width: 480px)");
		expect(css).toContain(".advanced-calendar-view--list .fc-toolbar-chunk:nth-child(2)");
		expect(css).toContain("order: -1");
		expect(css).toContain(".advanced-calendar-view--list .fc-toolbar-chunk:first-child");
		expect(css).toContain("flex: 1 1 100%");
	});

	it("prevents horizontal overflow from list agenda content and preserves task icons", () => {
		const css = readRepoFile("styles/advanced-calendar-view.css");

		expect(css).toContain(".advanced-calendar-view--list");
		expect(css).toContain("overflow-x: hidden");
		expect(css).toContain(".advanced-calendar-view--list .fc-list-table");
		expect(css).toContain("table-layout: fixed");
		expect(css).toContain(".advanced-calendar-view--list .task-card__title-text");
		expect(css).toContain("overflow-wrap: anywhere");
		expect(css).toContain(".advanced-calendar-view--list .task-card__badges");
		expect(css).toContain("flex: 0 0 auto");
	});
});
