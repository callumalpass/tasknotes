import { Menu } from "obsidian";
import { DateContextMenu } from "../../../src/components/DateContextMenu";

type MockMenu = {
	showAtMouseEvent: jest.Mock;
	hide: jest.Mock;
};

const menuMock = Menu as unknown as jest.Mock;

function createDateTrigger(): HTMLElement {
	const trigger = document.createElement("span");
	trigger.dataset.tnAction = "edit-date";
	trigger.dataset.tnDateType = "scheduled";
	document.body.appendChild(trigger);
	return trigger;
}

function showDateMenuFrom(trigger: HTMLElement): MockMenu {
	const firstNewMenuIndex = menuMock.mock.results.length;
	const dateMenu = new DateContextMenu({
		currentValue: "2026-04-30",
		onSelect: jest.fn(),
	});
	trigger.addEventListener("click", (event) => dateMenu.show(event), { once: true });
	trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	return menuMock.mock.results[firstNewMenuIndex].value as MockMenu;
}

describe("DateContextMenu (#1849)", () => {
	afterEach(() => {
		for (const result of menuMock.mock.results) {
			(result.value as Partial<MockMenu>).hide?.();
		}
		menuMock.mockClear();
		document.body.innerHTML = "";
	});

	it("closes the active date menu instead of opening another menu for the same trigger", () => {
		const trigger = createDateTrigger();

		const firstMenu = showDateMenuFrom(trigger);
		const secondMenu = showDateMenuFrom(trigger);

		expect(firstMenu.showAtMouseEvent).toHaveBeenCalledTimes(1);
		expect(firstMenu.hide).toHaveBeenCalledTimes(1);
		expect(secondMenu.showAtMouseEvent).not.toHaveBeenCalled();
	});

	it("replaces the active date menu when another task date trigger is clicked", () => {
		const firstTrigger = createDateTrigger();
		const secondTrigger = createDateTrigger();

		const firstMenu = showDateMenuFrom(firstTrigger);
		const secondMenu = showDateMenuFrom(secondTrigger);

		expect(firstMenu.hide).toHaveBeenCalledTimes(1);
		expect(secondMenu.showAtMouseEvent).toHaveBeenCalledTimes(1);
	});
});
