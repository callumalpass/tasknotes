export interface PopoverPoint {
	x: number;
	y: number;
}

export interface PopoverOptions {
	anchor: HTMLElement | PopoverPoint;
	className?: string;
	onClose?: () => void;
}

export interface PopoverHandle {
	el: HTMLElement;
	close: () => void;
	reposition: () => void;
}

const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 4;

function isElementAnchor(anchor: HTMLElement | PopoverPoint): anchor is HTMLElement {
	return "getBoundingClientRect" in anchor;
}

/** Below the anchor unless that overflows, then above. Always kept on screen. */
export function placePopover(
	anchor: { left: number; top: number; bottom: number },
	size: { width: number; height: number },
	viewport: { width: number; height: number }
): { left: number; top: number } {
	const maxLeft = viewport.width - size.width - VIEWPORT_MARGIN;
	const left = Math.max(VIEWPORT_MARGIN, Math.min(anchor.left, maxLeft));
	const below = anchor.bottom + ANCHOR_GAP;
	const above = anchor.top - ANCHOR_GAP - size.height;
	const fitsBelow = below + size.height <= viewport.height - VIEWPORT_MARGIN;
	const top = fitsBelow || above < VIEWPORT_MARGIN ? below : above;
	return { left, top: Math.max(VIEWPORT_MARGIN, top) };
}

let current: PopoverHandle | null = null;

export function closeActivePopover(): void {
	current?.close();
}

/** One popover at a time, mounted on the anchor's window so pop-outs work. */
export function openPopover(options: PopoverOptions): PopoverHandle {
	closeActivePopover();

	const { anchor } = options;
	const doc = isElementAnchor(anchor) ? anchor.ownerDocument : activeDocument;
	const win = doc.defaultView ?? activeWindow;
	const returnFocus = doc.activeElement as HTMLElement | null;

	const el = doc.body.createDiv({
		cls: ["tasknotes-plugin", "tn-popover", options.className ?? ""].filter(Boolean),
	});

	const reposition = () => {
		const rect = isElementAnchor(anchor)
			? anchor.getBoundingClientRect()
			: { left: anchor.x, top: anchor.y, bottom: anchor.y };
		const { left, top } = placePopover(rect, el.getBoundingClientRect(), {
			width: win.innerWidth,
			height: win.innerHeight,
		});
		el.setCssProps({ "--tn-popover-left": `${left}px`, "--tn-popover-top": `${top}px` });
	};

	let closed = false;
	const onPointerDown = (event: PointerEvent) => {
		if (!el.contains(event.target as Node)) handle.close();
	};
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		event.stopPropagation();
		handle.close();
	};

	const handle: PopoverHandle = {
		el,
		reposition,
		close: () => {
			if (closed) return;
			closed = true;
			doc.removeEventListener("pointerdown", onPointerDown, true);
			doc.removeEventListener("keydown", onKeyDown, true);
			win.removeEventListener("blur", handle.close);
			el.remove();
			if (current === handle) current = null;
			returnFocus?.focus?.();
			options.onClose?.();
		},
	};

	doc.addEventListener("pointerdown", onPointerDown, true);
	doc.addEventListener("keydown", onKeyDown, true);
	win.addEventListener("blur", handle.close);
	current = handle;
	return handle;
}
