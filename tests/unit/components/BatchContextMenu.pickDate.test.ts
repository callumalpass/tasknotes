import { App } from "obsidian";
import { BatchContextMenu } from "../../../src/components/BatchContextMenu";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import { openTaskPropertyPicker } from "../../../src/ui/taskPropertyPickers";

jest.mock("../../../src/ui/taskPropertyPickers", () => ({
	openTaskPropertyPicker: jest.fn(),
	archiveTasksWithUndo: jest.fn(),
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

it.each(["scheduled", "due"] as const)("opens the %s picker for the selected tasks and clears the selection only after a change", async role => {
	const { plugin, root } = setup();
	find(root, role === "scheduled" ? "Scheduled date" : "Due date").onClick.mock.calls[0][0]({ clientX: 40, clientY: 60 });
	await new Promise(resolve => setTimeout(resolve, 0));
	const call = (openTaskPropertyPicker as jest.Mock).mock.calls[0];
	expect(call.slice(0, 4)).toEqual([plugin, role, [{ path: "Tasks/One.md" }, { path: "Tasks/Two.md" }], { x: 40, y: 60 }]);
	expect(plugin.taskSelectionService.clearSelection).not.toHaveBeenCalled();
	call[4]();
	expect(plugin.taskSelectionService.clearSelection).toHaveBeenCalled();
});
