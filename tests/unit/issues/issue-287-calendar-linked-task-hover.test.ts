/**
 * Issue #287: Calendar events generated from the same task should be visibly linked.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/287
 */

import { CalendarView } from "../../../src/bases/CalendarView";
import * as calendarCore from "../../../src/bases/calendar-core";
import { TaskFactory } from "../../helpers/mock-factories";

function mountEvent(view: CalendarView, root: HTMLElement, path: string, viewType = "week") {
	const el = root.createDiv();
	const taskInfo = TaskFactory.createTask({ path, tags: [] });
	(view as any).handleEventDidMount({
		el,
		view: { type: viewType },
		item: { id: `${path}-${root.childElementCount}`, title: "Task", start: "2026-05-19", data: { eventType: "scheduled", taskInfo } },
	});
	return el;
}

describe("Issue #287: linked calendar task hover states", () => {
	beforeAll(() => {
		// jsdom has no CSS.escape; Obsidian's Electron runtime does.
		if (typeof globalThis.CSS?.escape !== "function") {
			Object.assign(globalThis, {
				CSS: { escape: (value: string) => value.replace(/["\\]/g, "\\$&") },
			});
		}
	});

	beforeEach(() => {
		jest.spyOn(calendarCore, "generateTaskTooltip").mockReturnValue("");
		jest.spyOn(calendarCore, "addTaskHoverPreview").mockImplementation(() => undefined);
	});

	it("highlights other events of the hovered task only", () => {
		const root = document.createElement("div");
		const view = Object.create(CalendarView.prototype) as CalendarView;
		Object.assign(view, { rootElement: root, plugin: {} });

		const source = mountEvent(view, root, "Tasks/A \"quoted\".md");
		const sibling = mountEvent(view, root, "Tasks/A \"quoted\".md");
		const other = mountEvent(view, root, "Tasks/B.md");

		source.dispatchEvent(new MouseEvent("mouseenter"));
		expect(source.classList.contains("fc-task-event--hover-source")).toBe(true);
		expect(sibling.classList.contains("fc-task-event--related-hover")).toBe(true);
		expect(other.classList.contains("fc-task-event--related-hover")).toBe(false);

		source.dispatchEvent(new MouseEvent("mouseleave"));
		expect(source.classList.contains("fc-task-event--hover-source")).toBe(false);
		expect(sibling.classList.contains("fc-task-event--related-hover")).toBe(false);
	});

	it("does not link task cards in List view", () => {
		const root = document.createElement("div");
		const view = Object.create(CalendarView.prototype) as CalendarView;
		Object.assign(view, { rootElement: root, plugin: {} });

		const source = mountEvent(view, root, "Tasks/A.md", "list");
		const sibling = mountEvent(view, root, "Tasks/A.md", "list");

		source.dispatchEvent(new MouseEvent("mouseenter"));
		expect(sibling.classList.contains("fc-task-event--related-hover")).toBe(false);
	});
});
