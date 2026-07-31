import { App, Menu, TFile } from "obsidian";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import { createCompletionsCalendarSection } from "../../../src/modals/taskEditCompletions";
import type { TaskInfo } from "../../../src/types";
import { formatDateForStorage } from "../../../src/utils/dateUtils";

type MockMenuItem = Record<string, jest.Mock> | { type: string };
type MockMenu = {
	items: MockMenuItem[];
	showAtMouseEvent: jest.Mock;
};

const menuMock = Menu as unknown as jest.Mock;

function createRecurringTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		id: "Tasks/recurring.md",
		path: "Tasks/recurring.md",
		title: "Recurring task",
		status: "open",
		priority: "normal",
		recurrence: "DTSTART:20260501;FREQ=DAILY;INTERVAL=1",
		complete_instances: ["2026-05-16"],
		skipped_instances: [],
		...overrides,
	} as TaskInfo;
}

function createPlugin(): TaskNotesPlugin {
	const app = new App();
	return {
		app,
		i18n: createI18nService(),
		settings: {
			calendarViewSettings: {
				firstDay: 0,
			},
		},
		taskService: {
			findMaterializedOccurrence: jest.fn(),
			materializeOccurrence: jest.fn(),
		},
	} as unknown as TaskNotesPlugin;
}

function getLatestMenu(): MockMenu {
	return menuMock.mock.results[menuMock.mock.results.length - 1].value as MockMenu;
}

function findMenuItem(menu: MockMenu, title: string): Record<string, jest.Mock> | undefined {
	return menu.items.find(
		(item): item is Record<string, jest.Mock> =>
			!("type" in item) && item.setTitle.mock.calls[0]?.[0] === title
	);
}

function renderCompletionsCalendar(
	task: TaskInfo = createRecurringTask(),
	plugin: TaskNotesPlugin = createPlugin(),
	completedInstancesChanges: string[] = [],
	skippedInstancesChanges: string[] = []
): HTMLElement {
	const container = document.createElement("div");
	createCompletionsCalendarSection(container, {
		task,
		plugin,
		completedInstancesChanges,
		skippedInstancesChanges,
		translate: (key) => key,
	});
	return container;
}

describe("Task edit completions calendar occurrence context menu", () => {
	beforeEach(() => {
		menuMock.mockClear();
		document.body.innerHTML = "";
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it("opens an occurrence-specific menu from a recurring completion date", () => {
		const container = renderCompletionsCalendar();
		const day = container.querySelector<HTMLElement>(
			'[data-occurrence-date="2026-05-17"]'
		);
		expect(day).not.toBeNull();

		const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
		day?.dispatchEvent(event);

		const menu = getLatestMenu();
		const titles = menu.items
			.filter((item): item is Record<string, jest.Mock> => !("type" in item))
			.map((item) => item.setTitle.mock.calls[0]?.[0]);

		expect(event.defaultPrevented).toBe(true);
		expect(menu.showAtMouseEvent).toHaveBeenCalledWith(event);
		expect(titles).toEqual([
			"Open or create occurrence note",
			"Mark complete for this date",
			"Skip instance",
		]);
	});

	it("marks the clicked occurrence complete through the context menu without saving immediately", () => {
		const completedInstancesChanges: string[] = [];
		const container = renderCompletionsCalendar(
			createRecurringTask(),
			createPlugin(),
			completedInstancesChanges
		);
		const day = container.querySelector<HTMLElement>(
			'[data-occurrence-date="2026-05-17"]'
		);

		day?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
		const item = findMenuItem(getLatestMenu(), "Mark complete for this date");
		item?.onClick.mock.calls[0]?.[0]();

		expect(completedInstancesChanges).toEqual(["2026-05-17"]);
		expect(
			container
				.querySelector<HTMLElement>('[data-occurrence-date="2026-05-17"]')
				?.classList.contains("recurring-calendar__day--completed")
			).toBe(true);
	});

	it("marks the clicked occurrence skipped through the context menu without saving immediately", () => {
		const completedInstancesChanges: string[] = [];
		const skippedInstancesChanges: string[] = [];
		const container = renderCompletionsCalendar(
			createRecurringTask(),
			createPlugin(),
			completedInstancesChanges,
			skippedInstancesChanges
		);
		const day = container.querySelector<HTMLElement>(
			'[data-occurrence-date="2026-05-17"]'
		);

		day?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
		const item = findMenuItem(getLatestMenu(), "Skip instance");
		item?.onClick.mock.calls[0]?.[0]();

		expect(completedInstancesChanges).toEqual([]);
		expect(skippedInstancesChanges).toEqual(["2026-05-17"]);
		expect(
			container
				.querySelector<HTMLElement>('[data-occurrence-date="2026-05-17"]')
				?.classList.contains("recurring-calendar__day--skipped")
		).toBe(true);
	});

	it("marks a skipped occurrence complete and clears the pending skipped state", () => {
		const completedInstancesChanges: string[] = [];
		const skippedInstancesChanges: string[] = [];
		const container = renderCompletionsCalendar(
			createRecurringTask({ skipped_instances: ["2026-05-17"] }),
			createPlugin(),
			completedInstancesChanges,
			skippedInstancesChanges
		);
		const day = container.querySelector<HTMLElement>(
			'[data-occurrence-date="2026-05-17"]'
		);

		day?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
		const item = findMenuItem(getLatestMenu(), "Mark complete for this date");
		item?.onClick.mock.calls[0]?.[0]();
		const updatedDay = container.querySelector<HTMLElement>(
			'[data-occurrence-date="2026-05-17"]'
		);

		expect(completedInstancesChanges).toEqual(["2026-05-17"]);
		expect(skippedInstancesChanges).toEqual(["2026-05-17"]);
		expect(updatedDay?.classList.contains("recurring-calendar__day--completed")).toBe(true);
		expect(updatedDay?.classList.contains("recurring-calendar__day--skipped")).toBe(false);
	});

	it("opens or creates the occurrence note for the selected calendar occurrence", async () => {
		const task = createRecurringTask();
		const plugin = createPlugin();
		const openFile = jest.fn();
		const occurrence = {
			...task,
			path: "Tasks/recurring 2026-05-17.md",
			recurrence: undefined,
			recurrence_parent: "[[Tasks/recurring]]",
			occurrence_date: "2026-05-17",
		};
		plugin.taskService.findMaterializedOccurrence = jest.fn(async () => undefined);
		plugin.taskService.materializeOccurrence = jest.fn(async () => occurrence);
		plugin.app.vault.getAbstractFileByPath = jest.fn((path: string) => new TFile(path));
		plugin.app.workspace.getLeaf = jest.fn(() => ({ openFile }));

		const container = renderCompletionsCalendar(task, plugin);
		const day = container.querySelector<HTMLElement>(
			'[data-occurrence-date="2026-05-17"]'
		);
		day?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));

		const item = findMenuItem(getLatestMenu(), "Open or create occurrence note");
		await item?.onClick.mock.calls[0]?.[0]();

		const targetDate = (plugin.taskService.materializeOccurrence as jest.Mock).mock.calls[0][1];
		expect(formatDateForStorage(targetDate)).toBe("2026-05-17");
		expect(plugin.taskService.findMaterializedOccurrence).toHaveBeenCalledWith(
			task,
			targetDate
		);
		expect(openFile).toHaveBeenCalledWith(expect.objectContaining({ path: occurrence.path }));
		expect(plugin.app.workspace.getLeaf).toHaveBeenCalledWith(true);
	});
});
