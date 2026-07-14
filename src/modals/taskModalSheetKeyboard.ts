const KEYBOARD_INSET_THRESHOLD_PX = 48;
const TOOLBAR_INSET_THRESHOLD_PX = 8;
const SHEET_TOP_SAFE_INSET_PX = 16;
const REFRESH_DELAYS_MS = [0, 150, 350];
export const MOBILE_TOOLBAR_SELECTOR = ".mobile-toolbar";

export interface TaskModalSheetKeyboardOptions {
	modalEl: HTMLElement;
	getSnapMaxHeight: () => string;
	isDragging: () => boolean;
}

export interface TaskModalSheetKeyboardController {
	destroy: () => void;
	refresh: () => void;
}

export interface TaskModalSheetBottomInsetAdjustment {
	bottomInsetPx: number;
}

/** @deprecated Use TaskModalSheetBottomInsetAdjustment */
export type TaskModalSheetKeyboardAdjustment = TaskModalSheetBottomInsetAdjustment;

export function computeSheetKeyboardInset(
	layoutViewportHeight: number,
	visualViewport: Pick<VisualViewport, "height" | "offsetTop"> | null | undefined
): number {
	if (!visualViewport || !Number.isFinite(visualViewport.height)) {
		return 0;
	}

	const inset = layoutViewportHeight - (visualViewport.offsetTop + visualViewport.height);
	return inset > KEYBOARD_INSET_THRESHOLD_PX ? Math.round(inset) : 0;
}

export function isMobileToolbarVisible(toolbar: HTMLElement): boolean {
	const win = toolbar.ownerDocument.defaultView;
	if (!win) {
		return false;
	}

	const style = win.getComputedStyle(toolbar);
	if (style.display === "none" || style.visibility === "hidden") {
		return false;
	}

	const rect = toolbar.getBoundingClientRect();
	return rect.height > TOOLBAR_INSET_THRESHOLD_PX && rect.width > 0;
}

export function computeMobileToolbarInset(
	layoutViewportHeight: number,
	toolbar: Pick<HTMLElement, "getBoundingClientRect"> | null | undefined
): number {
	if (!toolbar || !isMobileToolbarVisible(toolbar as HTMLElement)) {
		return 0;
	}

	const rect = toolbar.getBoundingClientRect();
	// Only trust a toolbar that is actually docked within the visible
	// viewport. A stale/detached clone sharing the same class name (or one
	// not yet laid out, e.g. top: 0 before it snaps to the bottom) would
	// otherwise report a huge, bogus inset that pushes the whole sheet
	// off-screen above the top of the viewport instead of just resizing it.
	if (rect.top < 0 || rect.top >= layoutViewportHeight || rect.height <= 0) {
		return 0;
	}

	const inset = layoutViewportHeight - rect.top;
	return inset > TOOLBAR_INSET_THRESHOLD_PX ? Math.round(inset) : 0;
}

export function computeSheetBottomInset(
	layoutViewportHeight: number,
	visualViewport: Pick<VisualViewport, "height" | "offsetTop"> | null | undefined,
	toolbar?: Pick<HTMLElement, "getBoundingClientRect"> | null
): number {
	const rawInset = Math.max(
		computeSheetKeyboardInset(layoutViewportHeight, visualViewport),
		computeMobileToolbarInset(layoutViewportHeight, toolbar ?? null)
	);

	// Defensive clamp: no matter what the individual measurements report,
	// never let the combined inset push the sheet's translateY past the top
	// safe area. A bug (or an unexpected host environment) in either
	// measurement should degrade to "sheet sits near the top" rather than
	// "sheet is translated fully off-screen and invisible".
	const maxSaneInset = Math.max(0, layoutViewportHeight - SHEET_TOP_SAFE_INSET_PX);
	return Math.min(rawInset, maxSaneInset);
}

export function computeSheetBottomInsetMaxHeightPx(
	layoutViewportHeight: number,
	bottomInsetPx: number,
	visualViewport?: Pick<VisualViewport, "offsetTop"> | null
): number {
	const safeTop = Math.max(visualViewport?.offsetTop ?? 0, 0) + SHEET_TOP_SAFE_INSET_PX;
	const visibleBottom = layoutViewportHeight - bottomInsetPx;
	return Math.max(120, Math.floor(visibleBottom - safeTop));
}

/** @deprecated Use computeSheetBottomInsetMaxHeightPx */
export function computeSheetKeyboardMaxHeightPx(
	visualViewport: Pick<VisualViewport, "height" | "offsetTop">,
	topSafeInsetPx = SHEET_TOP_SAFE_INSET_PX
): number {
	const safeTop = Math.max(visualViewport.offsetTop, 0) + topSafeInsetPx;
	return Math.max(120, Math.floor(visualViewport.height - safeTop));
}

export function computeSheetBottomInsetAdjustment(
	layoutViewportHeight: number,
	visualViewport: Pick<VisualViewport, "height" | "offsetTop"> | null | undefined,
	toolbar?: Pick<HTMLElement, "getBoundingClientRect"> | null
): TaskModalSheetBottomInsetAdjustment {
	return {
		bottomInsetPx: computeSheetBottomInset(layoutViewportHeight, visualViewport, toolbar),
	};
}

/** @deprecated Use computeSheetBottomInsetAdjustment */
export function computeSheetKeyboardAdjustment(
	layoutViewportHeight: number,
	visualViewport: Pick<VisualViewport, "height" | "offsetTop"> | null | undefined
): TaskModalSheetBottomInsetAdjustment {
	const adjustment = computeSheetBottomInsetAdjustment(
		layoutViewportHeight,
		visualViewport,
		null
	);
	return {
		bottomInsetPx: adjustment.bottomInsetPx,
	};
}

function setSheetBottomInset(modalEl: HTMLElement, insetPx: number): void {
	const value = insetPx > 0 ? `${insetPx}px` : "0";
	if (typeof modalEl.setCssProps === "function") {
		modalEl.setCssProps({ "--tn-sheet-bottom-inset": value });
		return;
	}

	modalEl.style.setProperty("--tn-sheet-bottom-inset", value);
}

export function attachTaskModalSheetKeyboardAvoidance(
	options: TaskModalSheetKeyboardOptions
): TaskModalSheetKeyboardController {
	const { modalEl, getSnapMaxHeight, isDragging } = options;
	const doc = modalEl.ownerDocument;
	const win = doc.defaultView || window;
	const visualViewport = win.visualViewport;
	const refreshTimers: number[] = [];
	let toolbarResizeObserver: ResizeObserver | undefined;
	let toolbarMutationObserver: MutationObserver | undefined;
	let observedToolbar: HTMLElement | null = null;

	if (!visualViewport) {
		return { destroy: () => undefined, refresh: () => undefined };
	}

	let bottomInsetActive = false;
	let frozenSheetHeightPx: number | null = null;

	const freezeSheetHeight = (): void => {
		if (
			bottomInsetActive ||
			modalEl.classList.contains("tn-task-modal__sheet--pending")
		) {
			return;
		}

		const heightPx = Math.round(modalEl.getBoundingClientRect().height);
		if (heightPx <= 0) {
			return;
		}

		frozenSheetHeightPx = heightPx;
		modalEl.style.setProperty("--tn-sheet-max-height", `${heightPx}px`);
	};

	const getToolbar = (): HTMLElement | null => doc.querySelector(MOBILE_TOOLBAR_SELECTOR);

	const applyAdjustment = (): void => {
		if (isDragging()) return;

		const adjustment = computeSheetBottomInsetAdjustment(
			win.innerHeight,
			visualViewport,
			getToolbar()
		);
		const nextBottomInsetActive = adjustment.bottomInsetPx > 0;

		if (nextBottomInsetActive) {
			// Prefer the height captured before the keyboard animation started.
			// Reading getBoundingClientRect() here can return an already-shrunk
			// value because 100dvh updates as soon as the visual viewport
			// resizes on iOS/Android.
			if (
				!bottomInsetActive &&
				!modalEl.classList.contains("tn-task-modal__sheet--pending")
			) {
				const heightPx =
					frozenSheetHeightPx ?? Math.round(modalEl.getBoundingClientRect().height);
				if (heightPx > 0) {
					frozenSheetHeightPx = heightPx;
					modalEl.style.setProperty("--tn-sheet-max-height", `${heightPx}px`);
				}
			}
			setSheetBottomInset(modalEl, adjustment.bottomInsetPx);
			modalEl.addClass("tn-task-modal__sheet--bottom-inset");
		} else if (bottomInsetActive) {
			setSheetBottomInset(modalEl, 0);
			frozenSheetHeightPx = null;
			modalEl.style.setProperty("--tn-sheet-max-height", getSnapMaxHeight());
			modalEl.removeClass("tn-task-modal__sheet--bottom-inset");
		} else {
			setSheetBottomInset(modalEl, 0);
		}

		bottomInsetActive = nextBottomInsetActive;
	};

	const bindToolbarObserver = (): void => {
		const toolbar = getToolbar();
		if (toolbar === observedToolbar) {
			return;
		}

		if (toolbarResizeObserver && observedToolbar) {
			toolbarResizeObserver.unobserve(observedToolbar);
		}

		observedToolbar = toolbar;
		if (!toolbar || typeof ResizeObserver === "undefined") {
			return;
		}

		if (!toolbarResizeObserver) {
			toolbarResizeObserver = new ResizeObserver(() => {
				applyAdjustment();
			});
		}

		toolbarResizeObserver.observe(toolbar);
	};

	const scheduleRefresh = (): void => {
		for (const delay of REFRESH_DELAYS_MS) {
			const timer = win.setTimeout(() => {
				refreshTimers.splice(refreshTimers.indexOf(timer), 1);
				bindToolbarObserver();
				applyAdjustment();
			}, delay);
			refreshTimers.push(timer);
		}
	};

	const onViewportChange = (): void => {
		applyAdjustment();
	};

	const onFocusIn = (event: FocusEvent): void => {
		const target = event.target;
		if (!(target instanceof win.Node) || !modalEl.contains(target)) {
			return;
		}
		// Freeze before the OS keyboard animation shrinks dvh on the next frame.
		freezeSheetHeight();
		scheduleRefresh();
	};

	visualViewport.addEventListener("resize", onViewportChange);
	visualViewport.addEventListener("scroll", onViewportChange);
	modalEl.addEventListener("focusin", onFocusIn, true);

	if (typeof MutationObserver !== "undefined") {
		toolbarMutationObserver = new MutationObserver((mutations) => {
			// Skip mutations caused by our own updates to modalEl (class/style
			// changes applied by applyAdjustment itself) - reacting to those
			// would create a self-triggering feedback loop since modalEl lives
			// inside the observed doc.body subtree.
			const relevant = mutations.some((mutation) => {
				const target = mutation.target;
				return !(target instanceof win.Node) || !modalEl.contains(target);
			});
			if (!relevant) return;

			bindToolbarObserver();
			applyAdjustment();
		});
		toolbarMutationObserver.observe(doc.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class", "style", "hidden"],
		});
	}

	bindToolbarObserver();
	applyAdjustment();

	return {
		refresh: () => {
			bindToolbarObserver();
			applyAdjustment();
		},
		destroy: () => {
			for (const timer of refreshTimers) {
				win.clearTimeout(timer);
			}
			refreshTimers.length = 0;
			visualViewport.removeEventListener("resize", onViewportChange);
			visualViewport.removeEventListener("scroll", onViewportChange);
			modalEl.removeEventListener("focusin", onFocusIn, true);
			toolbarMutationObserver?.disconnect();
			if (toolbarResizeObserver && observedToolbar) {
				toolbarResizeObserver.unobserve(observedToolbar);
			}
			toolbarResizeObserver?.disconnect();
			frozenSheetHeightPx = null;
			modalEl.removeClass("tn-task-modal__sheet--bottom-inset");
			setSheetBottomInset(modalEl, 0);
		},
	};
}
