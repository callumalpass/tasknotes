const mockSetIcon = jest.fn();
const mockSetTooltip = jest.fn();

jest.mock("obsidian", () => ({
	setIcon: mockSetIcon,
	setTooltip: mockSetTooltip,
}));

import {
	createTaskModalChip,
	createTaskModalChipBreak,
	createTaskModalChipRow,
	createTaskModalChips,
} from "../../../src/modals/taskModalChipRow";

describe("taskModalChipRow", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		mockSetIcon.mockClear();
		mockSetTooltip.mockClear();
	});

	it("creates an accessible chip with icon, label, and click activation", () => {
		const container = document.createElement("div");
		const onClick = jest.fn();

		const chip = createTaskModalChip(container, {
			iconName: "star",
			label: "Priority",
			dataType: "priority",
			onClick,
		});

		expect(chip.classList.contains("tn-task-modal__chip")).toBe(true);
		expect(chip.getAttribute("aria-label")).toBe("Priority");
		expect(chip.getAttribute("data-type")).toBe("priority");
		expect(chip.querySelector(".tn-task-modal__chip-label")?.textContent).toBe("Priority");
		expect(mockSetTooltip).toHaveBeenCalledWith(chip, "Priority", { placement: "top" });

		const event = new MouseEvent("click", { bubbles: true, cancelable: true });
		chip.dispatchEvent(event);
		expect(onClick).toHaveBeenCalledWith(chip, event);
	});

	it("creates chips in spec order inside a wrapping chip row", () => {
		const container = document.createElement("div");
		const row = createTaskModalChipRow(container);
		const chips = createTaskModalChips(row, [
			{
				iconName: "dot-square",
				label: "Status",
				dataType: "status",
				onClick: jest.fn(),
			},
			{
				iconName: "target",
				label: "Due",
				dataType: "due-date",
				onClick: jest.fn(),
			},
		]);

		expect(row.classList.contains("tn-task-modal__chip-row")).toBe(true);
		expect(chips.map((chip) => chip.dataset.type)).toEqual(["status", "due-date"]);
	});

	it("creates a flex line break that forces the next chips onto a new row", () => {
		const container = document.createElement("div");
		const row = createTaskModalChipRow(container);
		createTaskModalChip(row, {
			iconName: "wand",
			label: "Fill",
			dataType: "nlp-fill",
			onClick: jest.fn(),
		});
		const lineBreak = createTaskModalChipBreak(row);
		createTaskModalChip(row, {
			iconName: "dot-square",
			label: "Status",
			dataType: "status",
			onClick: jest.fn(),
		});

		expect(lineBreak.classList.contains("tn-task-modal__chip-break")).toBe(true);
		expect(lineBreak.getAttribute("aria-hidden")).toBe("true");
		expect(Array.from(row.children).map((child) => child.className)).toEqual([
			"tn-task-modal__chip action-chip",
			"tn-task-modal__chip-break",
			"tn-task-modal__chip action-chip",
		]);
	});
});
