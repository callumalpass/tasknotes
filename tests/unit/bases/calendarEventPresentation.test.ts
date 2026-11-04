import * as obsidian from "obsidian";
import { decorateCalendarTaskGlyphs } from "../../../src/bases/calendarEventPresentation";
import { TaskFactory } from "../../helpers/mock-factories";
import type TaskNotesPlugin from "../../../src/main";

describe("calendar task glyphs", () => {
	const statuses = [
		{ value: "open", order: 0, isCompleted: false, color: "red" },
		{ value: "active", order: 1, isCompleted: false, color: "orange" },
		{ value: "done", order: 2, isCompleted: true, color: "green" },
	];
	const priorities = [{ value: "normal", weight: 1, color: "blue" }];
	const plugin = {
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
});
