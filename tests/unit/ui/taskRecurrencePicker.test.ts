import { App } from "obsidian";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import { applyTaskRecurrence, openRecurrenceChoices } from "../../../src/ui/taskRecurrencePicker";
import type { TaskInfo } from "../../../src/types";

const mockChangeTaskProperty = jest.fn();
const mockShowTaskUndo = jest.fn();
jest.mock("../../../src/ui/taskPropertyPickers", () => ({
	changeTaskProperty: (...args: unknown[]) => mockChangeTaskProperty(...args),
	showTaskUndo: (...args: unknown[]) => mockShowTaskUndo(...args),
}));

const mockOpenListPicker = jest.fn();
jest.mock("../../../src/ui/kit/listPicker", () => ({
	openListPicker: (options: unknown) => mockOpenListPicker(options),
}));

type PickerOptions = {
	items: { id: string; label: string; selected?: boolean }[];
	onChoose: (item: { id: string; label: string }) => void;
};

function open(recurrence?: string, anchor?: "scheduled" | "completion") {
	mockOpenListPicker.mockClear();
	const apply = jest.fn();
	const plugin = { i18n: createI18nService(), settings: {} } as unknown as TaskNotesPlugin;
	openRecurrenceChoices(plugin, new App(), { recurrence, anchor, scheduled: "2026-05-18" }, document.body, apply);
	return { apply, options: mockOpenListPicker.mock.calls[0][0] as PickerOptions };
}

describe("recurrence picker", () => {
	it("applies a preset with its anchor and clears the rule", () => {
		const { apply, options } = open();
		expect(options.items.some((item) => item.id === "clear")).toBe(false);
		const afterCompletion = options.items.find((item) => item.label === "Daily (after completion)");
		options.onChoose(afterCompletion!);
		expect(apply).toHaveBeenCalledWith(expect.stringContaining("FREQ=DAILY"), "completion");

		const { apply: applyClear, options: withRule } = open("FREQ=WEEKLY;BYDAY=MO", "scheduled");
		withRule.onChoose(withRule.items.find((item) => item.id === "clear")!);
		expect(applyClear).toHaveBeenCalledWith(undefined);
	});

	it("shows a rule that matches no preset as the selected current value", () => {
		const { apply, options } = open("FREQ=MONTHLY;BYDAY=2TU", "scheduled");
		const current = options.items[0];
		expect(current).toEqual(expect.objectContaining({ id: "current", selected: true }));
		expect(options.items.filter((item) => item.selected)).toHaveLength(1);
		options.onChoose(current);
		expect(apply).not.toHaveBeenCalled();
	});

	it("writes the anchor only when it changes, with one undo toast", async () => {
		const plugin = { i18n: createI18nService(), app: { vault: {} } } as unknown as TaskNotesPlugin;
		const task = { title: "Task", path: "Tasks/task.md", recurrence_anchor: "scheduled" } as TaskInfo;
		mockChangeTaskProperty.mockImplementation(async (_plugin, tasks: TaskInfo[], property: string, value: unknown) => [
			{ ...tasks[0], [property]: value },
		]);

		await applyTaskRecurrence(plugin, task, "FREQ=DAILY", "scheduled");
		expect(mockChangeTaskProperty.mock.calls.map((call) => call[2])).toEqual(["recurrence"]);

		mockChangeTaskProperty.mockClear();
		await applyTaskRecurrence(plugin, task, "FREQ=DAILY", "completion");
		expect(mockChangeTaskProperty.mock.calls.map((call) => [call[2], call[3]])).toEqual([
			["recurrence", "FREQ=DAILY"],
			["recurrence_anchor", "completion"],
		]);
		// Both writes share one feedback object, so one Undo restores both
		expect(mockChangeTaskProperty.mock.calls[0][4]).toBe(mockChangeTaskProperty.mock.calls[1][4]);
		expect(mockShowTaskUndo).toHaveBeenCalledTimes(2);
	});
});
