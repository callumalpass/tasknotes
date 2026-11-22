import type TaskNotesPlugin from "../../../src/main";
import { PriorityManager } from "../../../src/services/PriorityManager";
import { StatusManager } from "../../../src/services/StatusManager";
import { DEFAULT_PRIORITIES, DEFAULT_STATUSES } from "../../../src/settings/defaults";
import { openTaskPropertyChoices } from "../../../src/ui/taskPropertyPickers";
import type { ListPickerOptions } from "../../../src/ui/kit/listPicker";

const mockOpenListPicker = jest.fn();
jest.mock("../../../src/ui/kit/listPicker", () => ({
	openListPicker: (options: unknown) => mockOpenListPicker(options),
}));

async function pickerIds(property: "status" | "priority", plugin: TaskNotesPlugin): Promise<string[]> {
	mockOpenListPicker.mockClear();
	await openTaskPropertyChoices(plugin, property, [{}], document.body, jest.fn());
	const options = mockOpenListPicker.mock.calls[0][0] as { items: { id: string }[] };
	return options.items.map((item) => item.id).filter((id) => id !== "clear");
}

describe("status and priority pickers", () => {
	// Issue #1189: the order must match Settings, whatever order the values are stored in.
	it("lists values in the order Settings shows them", async () => {
		const plugin = {
			priorityManager: new PriorityManager([...DEFAULT_PRIORITIES]),
			statusManager: new StatusManager([...DEFAULT_STATUSES].reverse()),
			settings: {},
		} as unknown as TaskNotesPlugin;

		expect(await pickerIds("priority", plugin)).toEqual(
			[...DEFAULT_PRIORITIES].sort((a, b) => b.weight - a.weight).map((p) => p.value)
		);
		expect(await pickerIds("status", plugin)).toEqual(
			[...DEFAULT_STATUSES].sort((a, b) => a.order - b.order).map((s) => s.value)
		);
	});
});

it("offers removal when a project is assigned to only part of the task selection", async () => {
	mockOpenListPicker.mockClear();
	const assigned = { projects: ["[[Project]]", "[[Other]]"] };
	const unassigned = { projects: ["[[Other]]"] };
	const plugin = {
		cacheManager: { getAllTasks: async () => [{ projects: ["[[Available]]"] }] },
	} as unknown as TaskNotesPlugin;
	const apply = jest.fn();
	await openTaskPropertyChoices(plugin, "projects", [assigned, unassigned], document.body, apply);
	const picker = mockOpenListPicker.mock.calls[0][0] as ListPickerOptions;
	const project = picker.items.find((item) => item.id === "[[Project]]")!;
	expect(project.selected).toBe(true);
	expect(picker.items.at(-1)?.id).toBe("[[Available]]");
	picker.onChoose({ ...project, selected: false });
	const remove = apply.mock.calls[0][0];
	expect(remove(assigned)).toEqual(["[[Other]]"]);
	expect(remove(unassigned)).toBe(unassigned.projects);
	expect(remove({})).toBeUndefined();
});
