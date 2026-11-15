import type TaskNotesPlugin from "../../../src/main";
import { PriorityManager } from "../../../src/services/PriorityManager";
import { StatusManager } from "../../../src/services/StatusManager";
import { DEFAULT_PRIORITIES, DEFAULT_STATUSES } from "../../../src/settings/defaults";
import { openTaskPropertyChoices } from "../../../src/ui/taskPropertyPickers";

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
