/**
 * Issue #1189: priority dropdowns in the Add/Edit Task modal should follow the
 * same priority order shown in settings.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1189
 */

import { Menu } from "obsidian";
import { PriorityContextMenu } from "../../../src/components/PriorityContextMenu";
import { PriorityConfig } from "../../../src/types";

type MockMenuItem = {
	setTitle: jest.Mock;
};

type MockMenu = {
	items: MockMenuItem[];
};

const menuMock = Menu as unknown as jest.Mock;

function prioritiesInSettingsOrder(priorities: PriorityConfig[]): PriorityConfig[] {
	return [...priorities].sort((a, b) => a.weight - b.weight);
}

function createPlugin(priorities: PriorityConfig[]): any {
	return {
		priorityManager: {
			getPrioritiesByWeightAsc: jest.fn(() => prioritiesInSettingsOrder(priorities)),
		},
	};
}

function buildPriorityMenu(priorities: PriorityConfig[], currentValue?: string): MockMenu {
	const firstNewMenuIndex = menuMock.mock.results.length;
	new PriorityContextMenu({
		currentValue,
		onSelect: jest.fn(),
		plugin: createPlugin(priorities),
	});
	return menuMock.mock.results[firstNewMenuIndex].value as MockMenu;
}

function menuTitles(menu: MockMenu): string[] {
	return menu.items.map((item) => item.setTitle.mock.calls[0][0]);
}

describe("Issue #1189: priority dropdown sorting", () => {
	afterEach(() => {
		menuMock.mockClear();
	});

	it("matches the settings priority order instead of reversing by importance", () => {
		const priorities: PriorityConfig[] = [
			{ id: "low", value: "low", label: "4-Low", color: "#00aa00", weight: 3 },
			{ id: "normal", value: "normal", label: "3-Normal", color: "#ffaa00", weight: 2 },
			{ id: "high", value: "high", label: "2-High", color: "#ff6600", weight: 1 },
			{ id: "urgent", value: "urgent", label: "1-Urgent", color: "#ff0000", weight: 0 },
		];

		const menu = buildPriorityMenu(priorities);

		expect(menuTitles(menu)).toEqual(["1-Urgent", "2-High", "3-Normal", "4-Low"]);
	});

	it("keeps the selected priority marker without changing the configured order", () => {
		const priorities: PriorityConfig[] = [
			{ id: "low", value: "low", label: "Low", color: "#00aa00", weight: 0 },
			{ id: "normal", value: "normal", label: "Normal", color: "#ffaa00", weight: 1 },
			{ id: "high", value: "high", label: "High", color: "#ff6600", weight: 2 },
		];

		const menu = buildPriorityMenu(priorities, "normal");

		expect(menuTitles(menu)).toEqual(["Low", "✓ Normal", "High"]);
	});
});
