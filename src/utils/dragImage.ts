export type DragImageOffset = {
	x: number;
	y: number;
};

type RectLike = Pick<DOMRect, "left" | "top" | "width" | "height">;

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function calculateDragImageOffset(
	rect: RectLike,
	clientX: number,
	clientY: number
): DragImageOffset {
	const maxX = Math.max(0, rect.width);
	const maxY = Math.max(0, rect.height);

	return {
		x: clamp(clientX - rect.left, 0, maxX),
		y: clamp(clientY - rect.top, 0, maxY),
	};
}

export function setElementDragImage(
	event: DragEvent,
	sourceElement: HTMLElement,
	className?: string
): HTMLElement | null {
	const dataTransfer = event.dataTransfer;
	if (!dataTransfer || typeof dataTransfer.setDragImage !== "function") {
		return null;
	}

	const doc = sourceElement.ownerDocument;
	const body = doc.body;
	if (!body) {
		return null;
	}

	const rect = sourceElement.getBoundingClientRect();
	const dragImage = sourceElement.cloneNode(true) as HTMLElement;
	dragImage.classList.add("tasknotes-plugin");
	if (className) {
		dragImage.classList.add(className);
	}
	dragImage.setAttribute("aria-hidden", "true");
	dragImage.style.width = `${Math.max(0, rect.width)}px`;
	dragImage.style.height = `${Math.max(0, rect.height)}px`;

	body.appendChild(dragImage);

	const offset = calculateDragImageOffset(rect, event.clientX, event.clientY);
	dataTransfer.setDragImage(dragImage, offset.x, offset.y);

	const win = doc.defaultView;
	(win ?? window).setTimeout(() => {
		dragImage.remove();
	}, 0);

	return dragImage;
}
