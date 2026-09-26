import { Menu } from "obsidian";
import { PriorityContextMenu } from "../../../src/components/PriorityContextMenu";
import { PriorityConfig } from "../../../src/types";

type MockMenu = { items: Array<{ setIcon: jest.Mock }> };

const menuMock = Menu as unknown as jest.Mock;

describe("PriorityContextMenu icons", () => {
	afterEach(() => {
		menuMock.mockClear();
	});

	it("previews each priority's configured icon and falls back to a star", () => {
		const priorities: PriorityConfig[] = [
			{
				id: "low",
				value: "low",
				label: "Low",
				color: "#00aa00",
				weight: 0,
				icon: "arrow-down",
			},
			{ id: "normal", value: "normal", label: "Normal", color: "#ffaa00", weight: 1 },
			{
				id: "high",
				value: "high",
				label: "High",
				color: "#ff0000",
				weight: 2,
				icon: "flame",
			},
		];
		const firstNewMenuIndex = menuMock.mock.results.length;

		new PriorityContextMenu({
			onSelect: jest.fn(),
			plugin: {
				priorityManager: { getPrioritiesByWeightAsc: jest.fn(() => priorities) },
			} as never,
		});

		const menu = menuMock.mock.results[firstNewMenuIndex].value as MockMenu;
		expect(menu.items.map((item) => item.setIcon.mock.calls[0][0])).toEqual([
			"arrow-down",
			"star",
			"flame",
		]);
	});
});
