const mockSetTooltip = jest.fn();

jest.mock("obsidian", () => ({
	setTooltip: mockSetTooltip,
}));

import type { PriorityConfig, StatusConfig } from "../../../src/types";
import {
	updateTaskModalActionIconStates,
	type TaskModalActionIconState,
} from "../../../src/modals/taskModalActionIconStates";

function createActionBar(): HTMLElement {
	const actionBar = document.createElement("div");
	for (const dataType of [
		"due-date",
		"scheduled-date",
		"status",
		"priority",
		"recurrence",
		"reminders",
	]) {
		const icon = actionBar.createDiv({ cls: "action-icon" });
		icon.dataset.type = dataType;
		icon.createSpan({ cls: "icon" });
	}
	return actionBar;
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

	it("marks date icons active and updates translated tooltips when values exist", () => {
		const actionBar = createActionBar();

		updateTaskModalActionIconStates(
			actionBar,
			{ translate },
			createState({
				dueDate: "2026-05-20",
				scheduledDate: "2026-05-19T09:30",
			})
		);

		expect(actionBar.querySelector('[data-type="due-date"]')?.classList).toContain("has-value");
		expect(actionBar.querySelector('[data-type="scheduled-date"]')?.classList).toContain(
			"has-value"
		);
		expect(mockSetTooltip).toHaveBeenCalledWith(
			actionBar.querySelector('[data-type="due-date"]'),
			"modals.task.tooltips.dueValue:value=2026-05-20",
			{ placement: "top" }
		);
		expect(mockSetTooltip).toHaveBeenCalledWith(
			actionBar.querySelector('[data-type="scheduled-date"]'),
			"modals.task.tooltips.scheduledValue:value=2026-05-19T09:30",
			{ placement: "top" }
		);
	});

	it("marks non-default status and priority active and applies configured colors", () => {
		const actionBar = createActionBar();

		updateTaskModalActionIconStates(
			actionBar,
			{ translate },
			createState({ status: "done", priority: "high" })
		);

		const statusIcon = actionBar.querySelector<HTMLElement>('[data-type="status"]');
		const priorityIcon = actionBar.querySelector<HTMLElement>('[data-type="priority"]');

		expect(statusIcon?.classList.contains("has-value")).toBe(true);
		expect(priorityIcon?.classList.contains("has-value")).toBe(true);
		expect(statusIcon?.querySelector<HTMLElement>(".icon")?.style.color).toBe("rgb(0, 170, 0)");
		expect(priorityIcon?.querySelector<HTMLElement>(".icon")?.style.color).toBe(
			"rgb(255, 0, 0)"
		);
		expect(mockSetTooltip).toHaveBeenCalledWith(
			statusIcon,
			"modals.task.tooltips.statusValue:value=Done",
			{ placement: "top" }
		);
		expect(mockSetTooltip).toHaveBeenCalledWith(
			priorityIcon,
			"modals.task.tooltips.priorityValue:value=High",
			{ placement: "top" }
		);
	});

	it("clears active status and priority state while preserving configured default colors", () => {
		const actionBar = createActionBar();
		const statusIcon = actionBar.querySelector<HTMLElement>('[data-type="status"]')!;
		const priorityIcon = actionBar.querySelector<HTMLElement>('[data-type="priority"]')!;
		statusIcon.classList.add("has-value");
		priorityIcon.classList.add("has-value");
		statusIcon.querySelector<HTMLElement>(".icon")!.style.color = "#00aa00";
		priorityIcon.querySelector<HTMLElement>(".icon")!.style.color = "#ff0000";

		updateTaskModalActionIconStates(actionBar, { translate }, createState());

		expect(statusIcon.classList.contains("has-value")).toBe(false);
		expect(priorityIcon.classList.contains("has-value")).toBe(false);
		expect(statusIcon.querySelector<HTMLElement>(".icon")?.style.color).toBe(
			"rgb(153, 153, 153)"
		);
		expect(priorityIcon.querySelector<HTMLElement>(".icon")?.style.color).toBe(
			"rgb(153, 153, 153)"
		);
		expect(mockSetTooltip).toHaveBeenCalledWith(
			statusIcon,
			"modals.task.actions.status",
			{ placement: "top" }
		);
		expect(mockSetTooltip).toHaveBeenCalledWith(
			priorityIcon,
			"modals.task.actions.priority",
			{ placement: "top" }
		);
	});

	it("removes stale icon colors when no config color is available", () => {
		const actionBar = createActionBar();
		const statusIcon = actionBar.querySelector<HTMLElement>('[data-type="status"]')!;
		const priorityIcon = actionBar.querySelector<HTMLElement>('[data-type="priority"]')!;
		statusIcon.querySelector<HTMLElement>(".icon")!.style.color = "#00aa00";
		priorityIcon.querySelector<HTMLElement>(".icon")!.style.color = "#ff0000";

		updateTaskModalActionIconStates(
			actionBar,
			{ translate },
			createState({
				statusConfigs: [],
				priorityConfigs: [],
			})
		);

		expect(statusIcon.querySelector<HTMLElement>(".icon")?.style.color).toBe("");
		expect(priorityIcon.querySelector<HTMLElement>(".icon")?.style.color).toBe("");
	});

	it("updates recurrence and reminder active states", () => {
		const actionBar = createActionBar();

		updateTaskModalActionIconStates(
			actionBar,
			{ translate },
			createState({
				recurrenceRule: "FREQ=WEEKLY",
				recurrenceDisplayText: "Weekly",
				reminderCount: 2,
			})
		);

		const recurrenceIcon = actionBar.querySelector<HTMLElement>('[data-type="recurrence"]');
		const reminderIcon = actionBar.querySelector<HTMLElement>('[data-type="reminders"]');
		expect(recurrenceIcon?.classList.contains("has-value")).toBe(true);
		expect(reminderIcon?.classList.contains("has-value")).toBe(true);
		expect(mockSetTooltip).toHaveBeenCalledWith(
			recurrenceIcon,
			"modals.task.tooltips.recurrenceValue:value=Weekly",
			{ placement: "top" }
		);
		expect(mockSetTooltip).toHaveBeenCalledWith(
			reminderIcon,
			"modals.task.tooltips.remindersPlural:count=2",
			{ placement: "top" }
		);
	});

	it("uses the singular reminder tooltip for one reminder", () => {
		const actionBar = createActionBar();

		updateTaskModalActionIconStates(
			actionBar,
			{ translate },
			createState({ reminderCount: 1 })
		);

		expect(mockSetTooltip).toHaveBeenCalledWith(
			actionBar.querySelector('[data-type="reminders"]'),
			"modals.task.tooltips.remindersSingle",
			{ placement: "top" }
		);
	});
});
