import { Scope, type App } from "obsidian";

export interface PopoverPoint {
	x: number;
	y: number;
}

export interface PopoverOptions {
	anchor: HTMLElement | PopoverPoint;
	resolveAnchor?: () => HTMLElement | null;
	app?: App;
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
	const preferred = fitsBelow || above < VIEWPORT_MARGIN ? below : above;
	const top = Math.min(preferred, viewport.height - size.height - VIEWPORT_MARGIN);
	return { left, top: Math.max(VIEWPORT_MARGIN, top) };
}

let current: PopoverHandle | null = null;

export function closeActivePopover(): void {
	current?.close();
}

export function dismissTooltips(doc: Document): void {
	doc.querySelectorAll(".tooltip").forEach((tooltip) => tooltip.remove());
}

/** One popover at a time, mounted on the anchor's window so pop-outs work. */
export function openPopover(options: PopoverOptions): PopoverHandle {
	closeActivePopover();

	let { anchor } = options;
	const doc = isElementAnchor(anchor) ? anchor.ownerDocument : activeDocument;
	const win = doc.defaultView ?? activeWindow;
	const viewRoot = isElementAnchor(anchor)
		? anchor.closest<HTMLElement>(".bases-view .tasknotes-plugin[tabindex]")
		: doc.activeElement?.closest<HTMLElement>(".bases-view .tasknotes-plugin[tabindex]");
	const returnFocus = viewRoot ?? (isElementAnchor(anchor) && anchor.tabIndex >= 0
		? anchor
		: doc.activeElement as HTMLElement | null);
	const modal = isElementAnchor(anchor) ? anchor.closest(".modal-container") : null;

	const host = modal ?? doc.body;
	const el = host.createDiv({
		cls: ["tasknotes-plugin", "tn-popover", options.className ?? ""].filter(Boolean),
	});

	const reposition = () => {
		if (options.resolveAnchor) {
			const nextAnchor = options.resolveAnchor();
			if (!nextAnchor) {
				handle.close();
				return;
			}
			anchor = nextAnchor;
		}
		el.setCssProps({ "--tn-popover-height": `${Math.max(0, win.innerHeight - VIEWPORT_MARGIN * 2)}px` });
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
	let anchorFrame: number | null = null;
	let pointerInteraction = false;
	const isOtherModal = (target: EventTarget | null) => {
		const element = target as HTMLElement | null;
		const targetModal = element?.closest?.(".modal-container");
		return !!targetModal && targetModal !== modal && !el.contains(element);
	};
	const onPointerDown = (event: PointerEvent) => {
		if (isOtherModal(event.target)) return;
		pointerInteraction = true;
		if (el.contains(event.target as Node)) return;
		if (modal) {
			event.preventDefault();
			event.stopImmediatePropagation();
		} else {
			handle.close();
			win.setTimeout(() => {
				if (doc.activeElement === doc.body && viewRoot?.isConnected) viewRoot.focus({ preventScroll: true });
			}, 0);
		}
	};
	const onClick = (event: MouseEvent) => {
		if (isOtherModal(event.target)) return;
		if (!modal || el.contains(event.target as Node)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		handle.close();
	};
	const onKeyDown = (event: KeyboardEvent) => {
		if (isOtherModal(event.target)) return;
		pointerInteraction = false;
		dismissTooltips(doc);
		if (event.key !== "Escape") return;
		event.preventDefault();
		event.stopImmediatePropagation();
		handle.close();
	};

	const handle: PopoverHandle = {
		el,
		reposition,
		close: () => {
			if (closed) return;
			closed = true;
			if (scope) options.app?.keymap.popScope(scope);
			anchorObserver?.disconnect();
			if (anchorFrame !== null) win.cancelAnimationFrame(anchorFrame);
			doc.removeEventListener("pointerdown", onPointerDown, true);
			doc.removeEventListener("click", onClick, true);
			win.removeEventListener("keydown", onKeyDown, true);
			win.removeEventListener("blur", handle.close);
			win.removeEventListener("resize", reposition);
			doc.removeEventListener("scroll", reposition, true);
			el.remove();
			if (current === handle) current = null;
			if (returnFocus?.isConnected) {
				if (pointerInteraction) {
					const clearPointerFocus = () => {
						returnFocus.removeClass("tn-focus-from-pointer");
						returnFocus.removeEventListener("keydown", clearPointerFocus);
						returnFocus.removeEventListener("blur", clearPointerFocus);
					};
					returnFocus.addClass("tn-focus-from-pointer");
					returnFocus.addEventListener("keydown", clearPointerFocus);
					returnFocus.addEventListener("blur", clearPointerFocus);
				}
				returnFocus.focus({ preventScroll: true });
			}
			options.onClose?.();
		},
	};

	const Observer = doc.defaultView?.MutationObserver ?? MutationObserver;
	const anchorObserver = options.resolveAnchor ? new Observer(() => {
		if (anchorFrame !== null) return;
		anchorFrame = win.requestAnimationFrame(() => {
			anchorFrame = null;
			reposition();
		});
	}) : null;
	anchorObserver?.observe(doc.body, { childList: true, subtree: true });
	const scope = options.app ? new Scope(options.app.scope) : null;
	scope?.register(null, "Escape", (event) => {
		onKeyDown(event);
		return false;
	});
	if (scope) options.app?.keymap.pushScope(scope);
	doc.addEventListener("pointerdown", onPointerDown, true);
	doc.addEventListener("click", onClick, true);
	win.addEventListener("keydown", onKeyDown, true);
	win.addEventListener("blur", handle.close);
	win.addEventListener("resize", reposition);
	doc.addEventListener("scroll", reposition, true);
	current = handle;
	return handle;
}
