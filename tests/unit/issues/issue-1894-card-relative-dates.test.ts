import { App, Menu } from "obsidian";
import { DateContextMenu } from "../../../src/components/DateContextMenu";
import { openTaskPropertyChoices } from "../../../src/ui/taskPropertyPickers";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

// Exercise real calendar arithmetic, not the global date-fns mock.
jest.mock("date-fns", () => jest.requireActual("../../../node_modules/date-fns"));
const mockOpenListPicker = jest.fn((options: unknown) => ({ options, close: jest.fn() }));
jest.mock("../../../src/ui/kit/listPicker", () => ({
	openListPicker: (options: unknown) => mockOpenListPicker(options),
}));
jest.mock("../../../src/ui/taskPropertyPickers", () => ({
	...jest.requireActual("../../../src/ui/taskPropertyPickers"),
	changeTaskProperty: async (plugin: TaskNotesPlugin, tasks: TaskInfo[], property: keyof TaskInfo, value: unknown) => {
		for (const task of tasks) await plugin.updateTaskProperty(task, property, value);
	},
}));

type MockMenuItem = Record<string, jest.Mock>;
type MockMenu = { items: (MockMenuItem | { type: string })[] };
const menuMock = Menu as unknown as jest.Mock;

function findItem(menu: MockMenu, title: string): MockMenuItem {
	const item = menu.items.find(
		(item) => !("type" in item) && item.setTitle.mock.calls[0]?.[0] === title
	);
	if (!item || "type" in item) throw new Error(`Missing menu item: ${title}`);
	return item;
}

function createPlugin(): TaskNotesPlugin {
	return {
		app: new App(),
		i18n: createI18nService(),
		settings: {
			customStatuses: [],
			customPriorities: [],
			calendarViewSettings: { timeFormat: "24", enableTimeblocking: false },
		},
		fieldMapper: {
			lookupMappingKey: (field: string) => field,
			toUserField: (field: string) => field,
		},
		statusManager: {
			getAllStatuses: () => [],
			getNonCompletionStatuses: () => [],
			getCompletedStatuses: () => ["done"],
			isCompletedStatus: () => false,
		},
		priorityManager: { getPrioritiesByWeight: () => [] },
		cacheManager: { getAllContexts: () => [], getAllTasks: () => [] },
		getActiveTimeSession: () => null,
		updateTaskProperty: jest.fn().mockResolvedValue(undefined),
	} as unknown as TaskNotesPlugin;
}

type DateField = "scheduled" | "due";
type Choice = { choose: () => Promise<void> };

// Card controls and the task menu both open the date picker.
async function openMenu(
	task: TaskInfo,
	field: DateField,
	plugin: TaskNotesPlugin
): Promise<(label: string) => Choice> {
	mockOpenListPicker.mockClear();
	await openTaskPropertyChoices(plugin, field, [task], document.body, (value) =>
		plugin.updateTaskProperty(task, field, typeof value === "function" ? value(task) : value)
	);
	const options = mockOpenListPicker.mock.calls[0][0] as {
		items: { id: string; label: string }[];
		onChoose: (item: { id: string; label: string }) => void;
	};
	return (label) => {
		const item = options.items.find((entry) => entry.label === (label === "Clear date" ? "Clear" : label));
		if (!item) throw new Error(`Missing picker item: ${label}`);
		return { choose: async () => options.onChoose(item) };
	};
}

const shifts = [
	{ label: "+1 day", days: 1 },
	{ label: "-1 day", days: -1 },
	{ label: "+1 week", days: 7 },
	{ label: "-1 week", days: -7 },
];

// Expected dates use UTC calendar fields so the oracle is independent of local DST.
function shiftedDate(date: string, days: number): string {
	const result = new Date(`${date}T12:00:00Z`);
	result.setUTCDate(result.getUTCDate() + days);
	return result.toISOString().slice(0, 10);
}

function createTask(field: DateField, value: string): TaskInfo {
	return {
		path: "Tasks/1894.md",
		title: "Relative date",
		status: "open",
		[field]: value,
	} as TaskInfo;
}

describe("#1894: relative date actions through card and menu callbacks", () => {
	afterEach(() => {
		for (const result of menuMock.mock.results) result.value.hide?.();
		menuMock.mockClear();
		document.body.innerHTML = "";
	});

	describe("picker", () => {
		describe.each<DateField>(["scheduled", "due"])("%s", (field) => {
			it.each(
				["2026-05-16", "2026-03-07", "2026-03-09", "2026-10-31", "2026-11-02"].flatMap(
					(date) =>
						["", "T21:37", "T00:00"].flatMap((time) =>
							shifts.map((shift) => ({ date, time, ...shift }))
						)
				)
			)("$label from $date$time", async ({ date, time, label, days }) => {
				const plugin = createPlugin();
				const task = createTask(field, date + time);
				const choose = await openMenu(task, field, plugin);
				await choose(label).choose();
				expect(plugin.updateTaskProperty).toHaveBeenCalledTimes(1);
				expect(plugin.updateTaskProperty).toHaveBeenCalledWith(
					task,
					field,
					shiftedDate(date, days) + time
				);
			});

			it("keeps absolute presets and clearing unchanged", async () => {
				const plugin = createPlugin();
				const task = createTask(field, "2026-05-16T21:37");
				const choose = await openMenu(task, field, plugin);
				await choose("Tomorrow").choose();
				expect(plugin.updateTaskProperty).toHaveBeenLastCalledWith(
					task,
					field,
					expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
				);
				await choose("Clear date").choose();
				expect(plugin.updateTaskProperty).toHaveBeenLastCalledWith(task, field, undefined);
			});
		});
	});

	it("also preserves embedded time for standalone datetime menus", async () => {
		const onSelect = jest.fn();
		new DateContextMenu({ currentValue: "2026-05-16T21:37", onSelect });
		await findItem(menuMock.mock.results[0].value, "+1 day").onClick.mock.calls[0][0]();
		expect(onSelect).toHaveBeenCalledWith("2026-05-17T21:37", null);
	});
});
