const mockSetIcon = jest.fn();
const mockSetTooltip = jest.fn();

jest.mock("obsidian", () => ({
	setIcon: mockSetIcon,
	setTooltip: mockSetTooltip,
}));

import {
	createTaskModalActionIcon,
	createTaskModalActionIcons,
} from "../../../src/modals/taskModalActionBar";

describe("taskModalActionBar", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		mockSetIcon.mockClear();
		mockSetTooltip.mockClear();
	});

	it("creates an accessible action icon with data type, icon, tooltip, and click activation", () => {
		const container = document.createElement("div");
		const onClick = jest.fn();

		const icon = createTaskModalActionIcon(container, {
			iconName: "star",
			tooltip: "Priority",
			dataType: "priority",
			onClick,
		});

		expect(icon.classList.contains("action-icon")).toBe(true);
		expect(icon.getAttribute("aria-label")).toBe("Priority");
		expect(icon.getAttribute("data-initial-tooltip")).toBe("Priority");
		expect(icon.getAttribute("data-type")).toBe("priority");
		expect(icon.getAttribute("role")).toBe("button");
		expect(icon.getAttribute("tabindex")).toBe("0");
		expect(mockSetTooltip).toHaveBeenCalledWith(icon, "Priority", { placement: "top" });
		expect(mockSetIcon).toHaveBeenCalledWith(icon.querySelector(".icon"), "star");

		const event = new MouseEvent("click", { bubbles: true, cancelable: true });
		const preventDefault = jest.spyOn(event, "preventDefault");
		const stopPropagation = jest.spyOn(event, "stopPropagation");
		icon.dispatchEvent(event);

		expect(preventDefault).toHaveBeenCalled();
		expect(stopPropagation).toHaveBeenCalled();
		expect(onClick).toHaveBeenCalledWith(icon, event);
	});

	it("activates with Enter and Space but ignores other keys", () => {
		const container = document.createElement("div");
		const onClick = jest.fn();
		const icon = createTaskModalActionIcon(container, {
			iconName: "bell",
			tooltip: "Reminder",
			onClick,
		});

		icon.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
		icon.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		icon.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));

		expect(onClick).toHaveBeenCalledTimes(2);
	});

	it("creates action icons in spec order", () => {
		const container = document.createElement("div");
		const icons = createTaskModalActionIcons(container, [
			{
				iconName: "dot-square",
				tooltip: "Status",
				dataType: "status",
				onClick: jest.fn(),
			},
			{
				iconName: "calendar",
				tooltip: "Due",
				dataType: "due-date",
				onClick: jest.fn(),
			},
		]);

		expect(icons.map((icon) => icon.dataset.type)).toEqual(["status", "due-date"]);
		expect(Array.from(container.querySelectorAll(".action-icon"))).toEqual(icons);
	});
});
