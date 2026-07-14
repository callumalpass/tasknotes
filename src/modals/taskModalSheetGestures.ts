import { attachTaskModalSheetKeyboardAvoidance } from "./taskModalSheetKeyboard";

export interface TaskModalSheetGestureOptions {
	containerEl: HTMLElement;
	modalEl: HTMLElement;
	onDismiss: () => void;
	onSnapChange?: (snap: "partial" | "full") => void;
}

export interface TaskModalSheetGestureController {
	destroy: () => void;
	expandToFull: () => void;
}

export const PARTIAL_SNAP_MAX_HEIGHT = "60dvh";
/** Minimum gap left above the sheet when fully expanded (matches mobile modal rules). */
export const SHEET_TOP_SAFE_INSET = "16px";
export const FULL_SNAP_MAX_HEIGHT = `calc(100dvh - ${SHEET_TOP_SAFE_INSET} - env(safe-area-inset-top))`;
const DISMISS_THRESHOLD_PX = 120;
const EXPAND_DRAG_THRESHOLD_PX = 40;
const COLLAPSE_DRAG_THRESHOLD_PX = 80;
const FLING_VELOCITY = 0.8;
// If the pointer has been stationary for longer than this before release,
// the last measured velocity is stale and should not be treated as a fling.
const STALE_VELOCITY_MS = 100;

function setSheetOffset(modalEl: HTMLElement, offsetPx: number): void {
	const value = offsetPx > 0 ? `${offsetPx}px` : "0";
	if (typeof modalEl.setCssProps === "function") {
		modalEl.setCssProps({ "--tn-sheet-offset": value });
		return;
	}

	modalEl.style.setProperty("--tn-sheet-offset", value);
}

function setSheetMaxHeight(modalEl: HTMLElement, value: string): void {
	if (typeof modalEl.setCssProps === "function") {
		modalEl.setCssProps({ "--tn-sheet-max-height": value });
		return;
	}

	modalEl.style.setProperty("--tn-sheet-max-height", value);
}

export function attachTaskModalSheetGestures(
	options: TaskModalSheetGestureOptions
): TaskModalSheetGestureController {
	const { containerEl, modalEl, onDismiss } = options;
	const handle = containerEl.querySelector<HTMLElement>(".tn-task-modal__sheet-handle");
	if (!handle) {
		// No handle to drive the reveal - make sure the sheet doesn't stay
		// stuck off-screen from the "--pending" state applied in onOpen().
		modalEl.removeClass("tn-task-modal__sheet--pending");
		return { destroy: () => undefined, expandToFull: () => undefined };
	}

	let dragging = false;
	let activePointerId: number | null = null;
	let startY = 0;
	let startOffset = 0;
	let currentOffset = 0;
	let currentSnap: "partial" | "full" = "partial";
	let lastY = 0;
	let lastTime = 0;
	let velocity = 0;

	const getMaxHeight = (): number => {
		return modalEl.getBoundingClientRect().height;
	};

	const applyOffset = (offset: number): void => {
		currentOffset = Math.max(0, offset);
		setSheetOffset(modalEl, currentOffset);
	};

	const getSnapMaxHeight = (): string => {
		return currentSnap === "full" ? FULL_SNAP_MAX_HEIGHT : PARTIAL_SNAP_MAX_HEIGHT;
	};

	const keyboardAvoidance = attachTaskModalSheetKeyboardAvoidance({
		modalEl,
		getSnapMaxHeight,
		isDragging: () => dragging,
	});

	const snapTo = (snap: "partial" | "full"): void => {
		currentSnap = snap;
		setSheetMaxHeight(modalEl, getSnapMaxHeight());
		modalEl.removeClass("tn-task-modal__sheet--dragging");
		modalEl.addClass("tn-task-modal__sheet--snapping");
		applyOffset(0);
		options.onSnapChange?.(snap);
		keyboardAvoidance.refresh();
		window.setTimeout(() => {
			modalEl.removeClass("tn-task-modal__sheet--snapping");
			keyboardAvoidance.refresh();
		}, 250);
	};

	const expandToFull = (): void => {
		snapTo("full");
	};

	// pointermove/pointerup are attached to the window (rather than just the
	// handle) while a drag is active. The handle is a small hit target, and
	// relying solely on setPointerCapture to keep delivering events to it once
	// the finger moves outside its bounds is not reliable across all mobile
	// WebViews. Without this, a fast or large drag motion could leave the
	// handle's bounds and silently stop responding until the pointer was
	// re-pressed, which is what made the gesture feel "stuck" on mobile.
	const endDrag = (): void => {
		dragging = false;
		activePointerId = null;
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("pointercancel", onPointerCancel);
	};

	const onPointerDown = (event: PointerEvent): void => {
		if (event.button !== 0) return;
		// Ignore additional touches (e.g. an accidental second finger) while a
		// drag is already in progress, since restarting the gesture mid-drag
		// caused the sheet to jump.
		if (dragging) return;

		dragging = true;
		activePointerId = event.pointerId;
		startY = event.clientY;
		startOffset = currentOffset;
		lastY = event.clientY;
		lastTime = event.timeStamp;
		velocity = 0;

		try {
			handle.setPointerCapture(event.pointerId);
		} catch {
			// Pointer capture is best-effort; the window-level listeners below
			// are the primary mechanism keeping the drag alive.
		}

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);

		modalEl.addClass("tn-task-modal__sheet--dragging");
		modalEl.removeClass("tn-task-modal__sheet--snapping");
	};

	const onPointerMove = (event: PointerEvent): void => {
		if (!dragging || event.pointerId !== activePointerId) return;
		event.preventDefault();

		const delta = event.clientY - startY;
		applyOffset(startOffset + delta);

		const dt = event.timeStamp - lastTime;
		if (dt > 0) {
			velocity = (event.clientY - lastY) / dt;
		}
		lastY = event.clientY;
		lastTime = event.timeStamp;
	};

	const finishDrag = (event: PointerEvent): void => {
		if (!dragging || event.pointerId !== activePointerId) return;

		try {
			handle.releasePointerCapture(event.pointerId);
		} catch {
			// Ignore: capture may not have been established, or the pointer may
			// already have been released by the browser.
		}

		// If the pointer has been idle for a while before release, the last
		// recorded velocity sample is stale (common with touchmove batching
		// where trailing events report a delta-time of zero) and should not be
		// used to decide a fling.
		const idleTime = event.timeStamp - lastTime;
		const effectiveVelocity = idleTime > STALE_VELOCITY_MS ? 0 : velocity;
		const draggedUp = startY - event.clientY;
		const draggedDown = event.clientY - startY;

		endDrag();
		modalEl.removeClass("tn-task-modal__sheet--dragging");

		if (currentOffset > DISMISS_THRESHOLD_PX || effectiveVelocity > FLING_VELOCITY) {
			modalEl.addClass("tn-task-modal__sheet--dismissing");
			applyOffset(getMaxHeight());
			window.setTimeout(() => {
				modalEl.removeClass("tn-task-modal__sheet--dismissing");
				setSheetOffset(modalEl, 0);
				onDismiss();
			}, 200);
			return;
		}

		if (currentOffset > 0) {
			if (currentSnap === "full" && currentOffset > COLLAPSE_DRAG_THRESHOLD_PX) {
				snapTo("partial");
			} else {
				snapTo(currentSnap);
			}
			return;
		}

		if (effectiveVelocity < -FLING_VELOCITY || draggedUp > EXPAND_DRAG_THRESHOLD_PX) {
			snapTo("full");
			return;
		}

		if (
			currentSnap === "full" &&
			(effectiveVelocity > FLING_VELOCITY / 2 || draggedDown > COLLAPSE_DRAG_THRESHOLD_PX)
		) {
			snapTo("partial");
			return;
		}

		snapTo(currentSnap);
	};

	const onPointerUp = (event: PointerEvent): void => {
		finishDrag(event);
	};

	const onPointerCancel = (event: PointerEvent): void => {
		if (!dragging || event.pointerId !== activePointerId) return;
		// Treat a cancelled gesture (e.g. an interrupting system gesture) the
		// same as a release, snapping back rather than leaving the sheet
		// stranded mid-drag.
		finishDrag(event);
	};

	handle.addEventListener("pointerdown", onPointerDown);

	// Reveal the sheet at its partial resting height. Removing "--pending"
	// and applying the snap max-height together lets the sheet slide in
	// without first flashing at full height.
	window.setTimeout(() => {
		modalEl.removeClass("tn-task-modal__sheet--pending");
		snapTo("partial");
	}, 0);

	return {
		destroy: () => {
			keyboardAvoidance.destroy();
			handle.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
			modalEl.removeClass(
				"tn-task-modal__sheet--pending",
				"tn-task-modal__sheet--dragging",
				"tn-task-modal__sheet--snapping",
				"tn-task-modal__sheet--dismissing"
			);
			setSheetOffset(modalEl, 0);
			modalEl.style.removeProperty("--tn-sheet-max-height");
			modalEl.style.removeProperty("--tn-sheet-bottom-inset");
		},
		expandToFull,
	};
}

export function createTaskModalSheetHandle(container: HTMLElement): HTMLElement {
	const handle = container.createDiv("tn-task-modal__sheet-handle");
	handle.createDiv("tn-task-modal__sheet-handle-bar");
	handle.setAttribute("role", "presentation");
	return handle;
}
