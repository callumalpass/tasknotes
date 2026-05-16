import {
	calculateDragImageOffset,
	setElementDragImage,
} from "../../../src/utils/dragImage";

describe("issue 1783 - Kanban custom drag image", () => {
	afterEach(() => {
		jest.useRealTimers();
		document.body.replaceChildren();
	});

	it("calculates pointer offsets relative to the dragged element", () => {
		const rect = { left: 20, top: 40, width: 160, height: 90 } as DOMRect;

		expect(calculateDragImageOffset(rect, 75, 95)).toEqual({ x: 55, y: 55 });
	});

	it("clamps offsets to the dragged element bounds", () => {
		const rect = { left: 20, top: 40, width: 160, height: 90 } as DOMRect;

		expect(calculateDragImageOffset(rect, -10, 500)).toEqual({ x: 0, y: 90 });
		expect(calculateDragImageOffset(rect, 300, 10)).toEqual({ x: 160, y: 0 });
	});

	it("uses a cloned element as the browser drag image", () => {
		jest.useFakeTimers();
		const card = document.createElement("div");
		card.className = "kanban-view__card-wrapper";
		card.textContent = "Dragged task";
		card.getBoundingClientRect = jest.fn(
			() =>
				({
					left: 10,
					top: 20,
					width: 240,
					height: 80,
					right: 250,
					bottom: 100,
				}) as DOMRect
		);
		document.body.appendChild(card);

		const setDragImage = jest.fn();
		const event = {
			clientX: 70,
			clientY: 55,
			dataTransfer: {
				setDragImage,
			},
		} as unknown as DragEvent;

		const dragImage = setElementDragImage(event, card, "kanban-view__drag-image");

		expect(dragImage).not.toBeNull();
		expect(dragImage).not.toBe(card);
		expect(dragImage?.classList.contains("kanban-view__drag-image")).toBe(true);
		expect(dragImage?.getAttribute("aria-hidden")).toBe("true");
		expect(setDragImage).toHaveBeenCalledWith(dragImage, 60, 35);
		expect(document.body.contains(dragImage)).toBe(true);

		jest.runOnlyPendingTimers();
		expect(document.body.contains(dragImage)).toBe(false);
	});

	it("does nothing when the drag event has no data transfer", () => {
		const card = document.createElement("div");
		document.body.appendChild(card);

		const dragImage = setElementDragImage({ dataTransfer: null } as DragEvent, card);

		expect(dragImage).toBeNull();
		expect(document.body.children).toHaveLength(1);
	});
});
