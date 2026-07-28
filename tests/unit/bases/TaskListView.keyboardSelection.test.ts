import { TaskListView } from "../../../src/bases/TaskListView";

jest.mock(
	"tasknotes-nlp-core",
	() => ({
		NaturalLanguageParserCore: class {},
	}),
	{ virtual: true }
);

describe("TaskListView keyboard selection", () => {
	it("toggles the focused task through the existing selection service", () => {
		const toggleSelection = jest.fn();
		const view = {
			focusController: {
				getFocusedPathForEvent: jest.fn(() => "focused.md"),
			},
			plugin: {
				taskSelectionService: { toggleSelection },
			},
		};
		const event = new KeyboardEvent("keydown", {
			key: " ",
			cancelable: true,
		});
		const stopPropagation = jest.spyOn(event, "stopPropagation");

		(TaskListView.prototype as any).handleTaskListSelectionKeyDown.call(view, event);

		expect(event.defaultPrevented).toBe(true);
		expect(stopPropagation).toHaveBeenCalled();
		expect(toggleSelection).toHaveBeenCalledWith("focused.md");
	});

	it("leaves Space alone when focus is in an excluded control", () => {
		const toggleSelection = jest.fn();
		const view = {
			focusController: {
				getFocusedPathForEvent: jest.fn(() => null),
			},
			plugin: {
				taskSelectionService: { toggleSelection },
			},
		};
		const event = new KeyboardEvent("keydown", {
			key: " ",
			cancelable: true,
		});

		(TaskListView.prototype as any).handleTaskListSelectionKeyDown.call(view, event);

		expect(event.defaultPrevented).toBe(false);
		expect(toggleSelection).not.toHaveBeenCalled();
	});
});
