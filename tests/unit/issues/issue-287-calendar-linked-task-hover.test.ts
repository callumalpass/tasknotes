/**
 * Issue #287: Calendar events generated from the same task should be visibly linked.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/287
 */

import fs from "fs";
import path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

describe("Issue #287: linked calendar task hover states", () => {
	it("marks task calendar events by path and toggles related hover classes", () => {
		const source = readRepoFile("src/bases/CalendarView.ts");

		expect(source).toContain('arg.el.setAttribute("data-task-path", taskInfo.path)');
		expect(source).toContain("this.attachTaskEventHoverLink(arg.el, taskInfo.path)");
		expect(source).toContain('.fc-task-event[data-task-path="${CSS.escape(taskPath)}"]');
		expect(source).toContain("fc-task-event--hover-source");
		expect(source).toContain("fc-task-event--related-hover");
		expect(source).toContain("CSS.escape(taskPath)");
	});

	it("styles the linked hover state for calendar and agenda list events", () => {
		const css = readRepoFile("styles/advanced-calendar-view.css");

		expect(css).toContain(".advanced-calendar-view .fc-task-event--hover-source");
		expect(css).toContain(".advanced-calendar-view .fc-task-event--related-hover");
		expect(css).toContain(
			".advanced-calendar-view.advanced-calendar-view--list .fc-task-event--related-hover .fc-list-card-content"
		);
	});
});
