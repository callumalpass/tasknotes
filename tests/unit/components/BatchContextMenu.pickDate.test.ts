import { App, Menu } from "obsidian";
import { BatchContextMenu } from "../../../src/components/BatchContextMenu";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import { DateTimePickerModal, type DateTimePickerOptions } from "../../../src/modals/DateTimePickerModal";

jest.mock("../../../src/modals/DateTimePickerModal", () => ({
	DateTimePickerModal: jest.fn().mockImplementation(() => ({ open: jest.fn() })),
}));

type Item = Record<string, jest.Mock> | { type: string };
type MockMenu = { items: Item[] };
function find(menu: MockMenu, title: string): Record<string, jest.Mock> {
	for (const item of menu.items) {
		if (!("type" in item) && item.setTitle?.mock.calls[0]?.[0] === title) return item;
	}
	throw new Error(`Missing menu item ${title}`);
}
function setup() {
	const paths = ["Tasks/One.md", "Tasks/Two.md"];
	const plugin = {
		app: new App(), i18n: createI18nService(),
		settings: { customStatuses: [], calendarViewSettings: { firstDay: 1 } },
		priorityManager: { getPrioritiesByWeight: () => [] },
		cacheManager: { getTaskInfo: jest.fn(async path => ({ path })) },
		taskService: { updateProperty: jest.fn() },
		taskSelectionService: { clearSelection: jest.fn(), exitSelectionMode: jest.fn() },
	} as unknown as TaskNotesPlugin;
	const menu = new BatchContextMenu({ plugin, selectedPaths: paths });
	const root = (menu as unknown as { menu: MockMenu }).menu;
	return { paths, plugin, root };
}

beforeEach(() => jest.clearAllMocks());

it.each(["scheduled", "due"] as const)("opens the shared picker with the %s date role and updates the captured selection", async role => {
	const { paths, plugin, root } = setup();
	const parent = find(root, role === "scheduled" ? "Scheduled date" : "Due date");
	const submenu = parent.setSubmenu.mock.results[0].value as MockMenu;
	find(submenu, "Pick date & time…").onClick.mock.calls[0][0]();
	const options = (DateTimePickerModal as unknown as jest.Mock).mock.calls[0][1] as DateTimePickerOptions;
	expect(options.dateRole).toBe(role);
	// Selection changes elsewhere must not retarget an already-open picker.
	paths.push("Tasks/Other.md");
	options.onSelect("2026-12-14", "15:45");
	await new Promise(resolve => setTimeout(resolve, 0));
	expect(plugin.taskService.updateProperty).toHaveBeenCalledTimes(2);
	for (const path of ["Tasks/One.md", "Tasks/Two.md"]) {
		expect(plugin.taskService.updateProperty).toHaveBeenCalledWith({ path }, role, "2026-12-14T15:45");
	}
});

it("keeps a date-only choice date-only", async () => {
	const { plugin, root } = setup();
	const submenu = find(root, "Scheduled date").setSubmenu.mock.results[0].value as MockMenu;
	find(submenu, "Pick date & time…").onClick.mock.calls[0][0]();
	const options = (DateTimePickerModal as unknown as jest.Mock).mock.calls[0][1] as DateTimePickerOptions;
	options.onSelect("2026-12-14", null);
	await new Promise(resolve => setTimeout(resolve, 0));
	expect(plugin.taskService.updateProperty).toHaveBeenCalledWith({ path: "Tasks/One.md" }, "scheduled", "2026-12-14");
});

it("opening then cancelling the picker does not write or clear selection", () => {
	const { plugin, root } = setup();
	const submenu = find(root, "Due date").setSubmenu.mock.results[0].value as MockMenu;
	find(submenu, "Pick date & time…").onClick.mock.calls[0][0]();
	expect(plugin.taskService.updateProperty).not.toHaveBeenCalled();
	expect(plugin.taskSelectionService.clearSelection).not.toHaveBeenCalled();
});
