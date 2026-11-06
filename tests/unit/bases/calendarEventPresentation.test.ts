import * as obsidian from "obsidian";
import { attachCalendarTaskHoverLink, decorateCalendarEvent, decorateCalendarTaskGlyphs } from "../../../src/bases/calendarEventPresentation";
import type { ItemArg } from "@tasknotes/calendar";
import type { CalendarEventProps } from "../../../src/bases/calendarEngine";
import { TaskFactory } from "../../helpers/mock-factories";
import type TaskNotesPlugin from "../../../src/main";

describe("calendar task glyphs", () => {
	it("does not start a linked series highlight during a calendar gesture", () => {
		const root = document.createElement("div");
		root.innerHTML = '<div class="tnc tnc-dragging"><div class="fc-task-event" data-task-path="task.md"></div><div class="fc-task-event" data-task-path="task.md"></div></div>';
		const event = root.querySelector<HTMLElement>(".fc-task-event")!;
		attachCalendarTaskHoverLink(root, event, "task.md");
		event.dispatchEvent(new MouseEvent("mouseenter"));
		expect(root.querySelector(".fc-task-event--related-hover")).toBeNull();
	});
	const statuses = [
		{ value: "open", order: 0, isCompleted: false, color: "red" },
		{ value: "active", order: 1, isCompleted: false, color: "orange" },
		{ value: "done", order: 2, isCompleted: true, color: "green" },
	];
	const priorities = [{ value: "normal", weight: 1, color: "blue" }];
	const plugin = {
		settings: { calendarViewSettings: { timeFormat: "24" } },
		formatTime: (minutes: number) => `${minutes} min`,
		statusManager: {
			getStatusConfig: (value: string) => statuses.find(status => status.value === value),
			getAllStatuses: () => statuses,
		},
		priorityManager: {
			getPriorityConfig: () => priorities[0],
			getAllPriorities: () => priorities,
		},
	} as unknown as TaskNotesPlugin;

	it("uses the list's workflow and priority glyphs without duplicating or replacing event content", () => {
		const element = document.createElement("div");
		element.innerHTML = '<div class="tnc-item-title">Calendar task</div><span class="tnc-item-time">09:00</span>';
		const task = TaskFactory.createTask({ status: "active" });
		decorateCalendarTaskGlyphs(element, task, plugin);
		decorateCalendarTaskGlyphs(element, task, plugin);
		expect(element.querySelectorAll(".tn-task-glyphs")).toHaveLength(1);
		expect(element.querySelector(".tn-task-glyphs__status")?.getAttribute("data-tn-glyph")).toBe("progress");
		expect(element.querySelector(".tn-task-glyphs__priority")?.getAttribute("data-tn-glyph")).toBe("bars");
		expect(element.querySelector(".tnc-item-title")?.textContent).toBe("Calendar task");
		expect(element.querySelector(".tnc-item-time")?.textContent).toBe("09:00");
		expect(element.dataset.status).toBe("active");
		expect(element.dataset.priority).toBe("normal");
		expect(element.style.getPropertyValue("--tn-calendar-status-color")).toBe("orange");
	});

	it("preserves user-configured icons instead of substituting ranked glyphs", () => {
		const setIcon = jest.spyOn(obsidian, "setIcon");
		const element = document.createElement("div");
		element.innerHTML = '<div class="tnc-item-title">Custom task</div>';
		const customPlugin = {
			...plugin,
			statusManager: { ...plugin.statusManager, getStatusConfig: () => ({ ...statuses[0], icon: "star" }) },
			priorityManager: { ...plugin.priorityManager, getPriorityConfig: () => ({ ...priorities[0], icon: "flag" }) },
		} as unknown as TaskNotesPlugin;
		decorateCalendarTaskGlyphs(element, TaskFactory.createTask(), customPlugin);
		expect(setIcon).toHaveBeenCalledWith(element.querySelector(".tn-task-glyphs__status"), "star");
		expect(setIcon).toHaveBeenCalledWith(element.querySelector(".tn-task-glyphs__priority"), "flag");
		setIcon.mockRestore();
	});

	it.each(["timed", "dot", "bar"] as const)("labels tracked %s entries with the actual interval rather than the task estimate", variant => {
		const tooltip = jest.spyOn(obsidian, "setTooltip");
		const element = document.createElement("div");
		element.innerHTML = '<div class="tnc-item-title">Tracked task</div>';
		const task = TaskFactory.createTask({ title: "Tracked task", timeEstimate: 60, recurrence: undefined });
		const argument = {
			el: element, variant, view: { type: "day" }, timeText: "12:00",
			item: { id: "tracked", title: task.title, start: "2026-11-06T12:00", end: "2026-11-06T12:35", data: { eventType: "timeEntry", taskInfo: task } },
		} as ItemArg<CalendarEventProps>;
		decorateCalendarEvent({ plugin, rootElement: null }, argument);
		expect(element.getAttribute("aria-label")).toBe("Tracked task\n35 min tracked\n12:00 – 12:35");
		expect(tooltip).toHaveBeenCalledWith(element, "Tracked task\n35 min tracked\n12:00 – 12:35");
		tooltip.mockRestore();
	});

	it("does not put redundant row tooltips over the collision popover", () => {
		const tooltip = jest.spyOn(obsidian, "setTooltip");
		const element = document.createElement("div");
		element.innerHTML = '<div class="tnc-item-title">Readable task</div>';
		const task = TaskFactory.createTask({ recurrence: undefined });
		const argument = {
			el: element, variant: "list", view: { type: "week" }, timeText: "12:00 – 13:00",
			item: { id: "readable", title: task.title, start: "2026-11-06T12:00", end: "2026-11-06T13:00", data: { eventType: "scheduled", taskInfo: task } },
		} as ItemArg<CalendarEventProps>;
		decorateCalendarEvent({ plugin, rootElement: null }, argument);
		expect(tooltip).not.toHaveBeenCalled();
		tooltip.mockRestore();
	});
});
