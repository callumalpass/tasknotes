import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

describe("Calendar List task card width", () => {
	it("places custom list cards inside a full-width FullCalendar table cell", () => {
		const source = readRepoFile("src/bases/calendarEventMount.ts");

		expect(source).toContain('ownerDocument.createElement("td")');
		expect(source).toContain('cardCell.className = "fc-list-event-title fc-list-card-content"');
		expect(source).toContain("cardCell.colSpan = 3");
		expect(source).toContain("cardCell.appendChild(cardElement)");
		expect(source).toContain("arg.el.appendChild(cardCell)");
	});

	it("keeps the list card cell full-width within the fixed FullCalendar table", () => {
		const css = readRepoFile("styles/advanced-calendar-view.css");
		const basesCss = readRepoFile("styles/bases-views.css");

		expect(css).toContain(".advanced-calendar-view.advanced-calendar-view--list .fc-list-card-content");
		expect(css).toContain(".advanced-calendar-view.advanced-calendar-view--list .fc-list-task-card > td:not(.fc-list-card-content)");
		expect(css).toContain(".advanced-calendar-view.advanced-calendar-view--list .fc-list-event.fc-list-task-card:hover");
		expect(basesCss).toContain("#bases-calendar .fc-list-event.fc-list-task-card:hover > td");
		expect(css).toContain("box-sizing: border-box");
		expect(css).toContain("padding: 4px 10px");
		expect(css).toContain("width: 100%");
	});
});
