import { VirtualScroller } from "../../../src/utils/VirtualScroller";

type TestItem = {
	id: string;
	label: string;
};

function createTestScroller(items: TestItem[]) {
	const container = document.createElement("div");
	container.style.overflowY = "auto";

	const renderItem = jest.fn((item: TestItem, index: number) => {
		const element = document.createElement("div");
		element.dataset.key = item.id;
		element.textContent = `${item.label}:${index}`;
		return element;
	});

	const scroller = new VirtualScroller<TestItem>({
		container,
		items,
		itemHeight: 20,
		overscan: 0,
		renderItem,
		getItemKey: (item) => item.id,
	});

	return { container, renderItem, scroller };
}

function createTestScrollerWithContainer(container: HTMLElement, items: TestItem[]) {
	const renderItem = jest.fn((item: TestItem, index: number) => {
		const element = document.createElement("div");
		element.dataset.key = item.id;
		element.textContent = `${item.label}:${index}`;
		return element;
	});

	const scroller = new VirtualScroller<TestItem>({
		container,
		items,
		itemHeight: 20,
		overscan: 0,
		renderItem,
		getItemKey: (item) => item.id,
	});

	return { renderItem, scroller };
}

function renderedKeys(container: HTMLElement): string[] {
	return Array.from(container.querySelectorAll<HTMLElement>("[data-key]")).map(
		(element) => element.dataset.key ?? ""
	);
}

describe("VirtualScroller", () => {
	it("includes container bottom padding in the spacer height", () => {
		const container = document.createElement("div");
		container.style.overflowY = "auto";
		container.style.paddingBottom = "112px";

		createTestScrollerWithContainer(container, [
			{ id: "a", label: "A" },
			{ id: "b", label: "B" },
			{ id: "c", label: "C" },
		]);

		expect(
			container.querySelector<HTMLElement>(".virtual-scroller__spacer")?.style.height
		).toBe("172px");
	});

	it("reorders keyed items without rerendering existing visible elements", () => {
		const { container, renderItem, scroller } = createTestScroller([
			{ id: "a", label: "A" },
			{ id: "b", label: "B" },
			{ id: "c", label: "C" },
		]);
		const firstElement = container.querySelector<HTMLElement>("[data-key='a']");
		const secondElement = container.querySelector<HTMLElement>("[data-key='b']");
		const thirdElement = container.querySelector<HTMLElement>("[data-key='c']");
		renderItem.mockClear();

		const reordered = scroller.reorderItems({
			movedKeys: ["c"],
			targetKey: "a",
			position: "after",
		});

		expect(reordered).toBe(true);
		expect(scroller.getItems().map((item) => item.id)).toEqual(["a", "c", "b"]);
		expect(renderedKeys(container)).toEqual(["a", "c", "b"]);
		expect(renderItem).not.toHaveBeenCalled();
		expect(container.querySelector("[data-key='a']")).toBe(firstElement);
		expect(container.querySelector("[data-key='b']")).toBe(secondElement);
		expect(container.querySelector("[data-key='c']")).toBe(thirdElement);
	});

	it("preserves measured heights by item key when reordering", () => {
		const { scroller } = createTestScroller([
			{ id: "a", label: "A" },
			{ id: "b", label: "B" },
			{ id: "c", label: "C" },
		]);
		(scroller as any).itemHeights = new Map([
			[0, 11],
			[1, 22],
			[2, 33],
		]);

		expect(
			scroller.reorderItems({
				movedKeys: ["c"],
				targetKey: "a",
				position: "after",
			})
		).toBe(true);

		expect(Array.from((scroller as any).itemHeights.entries())).toEqual([
			[0, 11],
			[1, 33],
			[2, 22],
		]);
	});

	it("rejects reorders when keys are not stable after the move", () => {
		const container = document.createElement("div");
		container.style.overflowY = "auto";
		const scroller = new VirtualScroller<TestItem>({
			container,
			items: [
				{ id: "a", label: "A" },
				{ id: "b", label: "B" },
				{ id: "c", label: "C" },
			],
			itemHeight: 20,
			overscan: 0,
			renderItem: (item) => {
				const element = document.createElement("div");
				element.textContent = item.label;
				return element;
			},
		});

		expect(
			scroller.reorderItems({
				movedKeys: ["2"],
				targetKey: "0",
				position: "after",
			})
		).toBe(false);
	});

	it("rerenders only invalidated visible items", () => {
		const items = [
			{ id: "a", label: "A" },
			{ id: "b", label: "B" },
			{ id: "c", label: "C" },
		];
		const { container, renderItem, scroller } = createTestScroller(items);
		const firstElement = container.querySelector<HTMLElement>("[data-key='a']");
		const secondElement = container.querySelector<HTMLElement>("[data-key='b']");
		renderItem.mockClear();

		items[1].label = "B2";
		scroller.invalidateItems(["b"]);

		expect(renderItem).toHaveBeenCalledTimes(1);
		expect(container.querySelector("[data-key='a']")).toBe(firstElement);
		expect(container.querySelector("[data-key='b']")).not.toBe(secondElement);
		expect(container.querySelector("[data-key='b']")?.textContent).toBe("B2:1");
		expect(renderedKeys(container)).toEqual(["a", "b", "c"]);
	});

	it("removes keyed items without rebuilding remaining visible elements", () => {
		const { container, renderItem, scroller } = createTestScroller([
			{ id: "a", label: "A" },
			{ id: "b", label: "B" },
			{ id: "c", label: "C" },
		]);
		const firstElement = container.querySelector<HTMLElement>("[data-key='a']");
		const thirdElement = container.querySelector<HTMLElement>("[data-key='c']");
		renderItem.mockClear();

		expect(scroller.canRemoveItems(["b"])).toBe(true);
		expect(scroller.removeItems(["b"])).toBe(true);

		expect(scroller.getItems().map((item) => item.id)).toEqual(["a", "c"]);
		expect(renderedKeys(container)).toEqual(["a", "c"]);
		expect(renderItem).not.toHaveBeenCalled();
		expect(container.querySelector("[data-key='a']")).toBe(firstElement);
		expect(container.querySelector("[data-key='c']")).toBe(thirdElement);
	});

	it("inserts keyed items relative to a target without rebuilding visible elements", () => {
		const { container, renderItem, scroller } = createTestScroller([
			{ id: "a", label: "A" },
			{ id: "c", label: "C" },
		]);
		const firstElement = container.querySelector<HTMLElement>("[data-key='a']");
		const thirdElement = container.querySelector<HTMLElement>("[data-key='c']");
		renderItem.mockClear();

		expect(
			scroller.canInsertItems({
				items: [{ id: "b", label: "B" }],
				targetKey: "a",
				position: "after",
			})
		).toBe(true);
		expect(
			scroller.insertItems({
				items: [{ id: "b", label: "B" }],
				targetKey: "a",
				position: "after",
			})
		).toBe(true);

		expect(scroller.getItems().map((item) => item.id)).toEqual(["a", "b", "c"]);
		expect(renderedKeys(container)).toEqual(["a", "b", "c"]);
		expect(renderItem).toHaveBeenCalledTimes(1);
		expect(container.querySelector("[data-key='a']")).toBe(firstElement);
		expect(container.querySelector("[data-key='c']")).toBe(thirdElement);
	});
});
