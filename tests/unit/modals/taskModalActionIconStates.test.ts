const mockSetTooltip = jest.fn();
const mockSetIcon = jest.fn();

jest.mock("obsidian", () => ({
	setTooltip: mockSetTooltip,
	setIcon: (el: HTMLElement, _iconName: string) => {
		mockSetIcon(el, _iconName);
		const icon = document.createElement("span");
		icon.className = "icon";
		el.appendChild(icon);
	},
}));

import type { PriorityConfig, StatusConfig } from "../../../src/types";
import {
	updateTaskModalActionIconStates,
	type TaskModalActionIconState,
} from "../../../src/modals/taskModalActionIconStates";
import { createTaskModalChip, createTaskModalChipRow } from "../../../src/modals/taskModalChipRow";

function createChipRow(): HTMLElement {
	const container = document.createElement("div");
	const row = createTaskModalChipRow(container);
	for (const dataType of [
		"due-date",
		"scheduled-date",
		"status",
		"priority",
		"recurrence",
		"reminders",
		"contexts",
		"tags",
		"time-estimate",
	]) {
		createTaskModalChip(row, {
			iconName: "dot-square",
			label: dataType,
			dataType,
			onClick: jest.fn(),
		});
	}
	return row;
}

function createState(overrides: Partial<TaskModalActionIconState> = {}): TaskModalActionIconState {
	return {
		dueDate: "",
		scheduledDate: "",
		status: "open",
		priority: "normal",
		recurrenceRule: "",
		recurrenceDisplayText: "",
		reminderCount: 0,
		contexts: "",
		tags: "",
		timeEstimate: 0,
		defaultStatus: "open",
		defaultPriority: "normal",
		statusConfigs: [
			{
				id: "open",
				value: "open",
				label: "Open",
				color: "#999999",
				isCompleted: false,
				order: 0,
				autoArchive: false,
				autoArchiveDelay: 0,
			},
			{
				id: "done",
				value: "done",
				label: "Done",
				color: "#00aa00",
				isCompleted: true,
				order: 1,
				autoArchive: false,
				autoArchiveDelay: 0,
			},
		] satisfies StatusConfig[],
		priorityConfigs: [
			{
				id: "normal",
				value: "normal",
				label: "Normal",
				color: "#999999",
				weight: 0,
			},
			{
				id: "high",
				value: "high",
				label: "High",
				color: "#ff0000",
				weight: 10,
			},
		] satisfies PriorityConfig[],
		...overrides,
	};
}

function translate(key: string, params?: Record<string, string | number>): string {
	const suffix =
		params && Object.keys(params).length > 0
			? `:${Object.entries(params)
					.map(([name, value]) => `${name}=${value}`)
					.join(",")}`
			: "";
	return `${key}${suffix}`;
}

describe("taskModalActionIconStates", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		mockSetTooltip.mockClear();
	});

	it("marks due-date chip active and updates chip labels when values exist", () => {
		const actionBar = createChipRow();

		updateTaskModalActionIconStates(
			actionBar,
			{ translate },
			createState({
				dueDate: "2026-05-20",
			})
		);

		const dueChip = actionBar.querySelector('[data-type="due-date"]');
		expect(dueChip?.classList).toContain("has-value");
		expect(dueChip?.querySelector(".tn-task-modal__chip-label")?.textContent).toBeTruthy();
	});

	it("marks scheduled-date chip active and updates chip labels when values exist", () => {
		const actionBar = createChipRow();

		updateTaskModalActionIconStates(
			actionBar,
			{ translate },
			createState({
				scheduledDate: "2026-07-13",
			})
		);

		const scheduledChip = actionBar.querySelector('[data-type="scheduled-date"]');
		expect(scheduledChip?.classList).toContain("has-value");
		expect(
			scheduledChip?.querySelector(".tn-task-modal__chip-label")?.textContent
		).toBeTruthy();
	});

	it("marks non-default status and priority active and applies configured colors", () => {
		const actionBar = createChipRow();

		updateTaskModalActionIconStates(
			actionBar,
			{ translate },
			createState({ status: "done", priority: "high" })
		);

		const statusChip = actionBar.querySelector<HTMLElement>('[data-type="status"]');
		const priorityChip = actionBar.querySelector<HTMLElement>('[data-type="priority"]');

		expect(statusChip?.classList.contains("has-value")).toBe(true);
		expect(priorityChip?.classList.contains("has-value")).toBe(true);
		expect(statusChip?.querySelector<HTMLElement>(".icon")?.style.color).toBe("rgb(0, 170, 0)");
		expect(priorityChip?.querySelector<HTMLElement>(".icon")?.style.color).toBe(
			"rgb(255, 0, 0)"
		);
	});

	it("updates contexts, tags, and time estimate chip labels", () => {
		const actionBar = createChipRow();

		updateTaskModalActionIconStates(
			actionBar,
			{ translate },
			createState({
				contexts: "home, work",
				tags: "errand, shop",
				timeEstimate: 45,
			})
		);

		expect(
			actionBar.querySelector('[data-type="contexts"] .tn-task-modal__chip-label')?.textContent
		).toBe("modals.task.chips.contextsPlural:count=2");
		expect(
			actionBar.querySelector('[data-type="tags"] .tn-task-modal__chip-label')?.textContent
		).toBe("modals.task.chips.tagsPlural:count=2");
		expect(
			actionBar.querySelector('[data-type="time-estimate"] .tn-task-modal__chip-label')
				?.textContent
		).toBe("modals.task.chips.timeEstimateValue:minutes=45");
	});
});
