import type { EventRef } from "obsidian";
import { EVENT_DATE_CHANGED } from "../types";

interface BasesDateRolloverEmitter {
	on(event: string, callback: () => void): EventRef;
	offref(ref: EventRef): void;
}

export interface BasesDateRolloverOptions {
	emitter: BasesDateRolloverEmitter;
	getElement: () => HTMLElement | null;
	/** Receives the day the view last drew, in `Date.toDateString()` form. */
	onDateRollover: (previousDay: string) => void;
}

/**
 * Tells a Bases view about a new day. A view with no layout box (a background
 * tab, say) waits until it is next shown, however many days pass in between.
 */
export function registerBasesDateRollover({
	emitter,
	getElement,
	onDateRollover,
}: BasesDateRolloverOptions): () => void {
	let drawnDay = new Date().toDateString();
	let showObserver: ResizeObserver | null = null;

	const stopWaiting = (): void => {
		showObserver?.disconnect();
		showObserver = null;
	};

	const redraw = (): void => {
		const previousDay = drawnDay;
		drawnDay = new Date().toDateString();
		if (drawnDay !== previousDay) onDateRollover(previousDay);
	};

	const ref = emitter.on(EVENT_DATE_CHANGED, () => {
		const element = getElement();
		if (!element) return;
		if (element.getClientRects().length > 0) {
			stopWaiting();
			redraw();
		} else if (!showObserver) {
			const win = element.ownerDocument.defaultView ?? window;
			showObserver = new win.ResizeObserver(() => {
				if (element.getClientRects().length === 0) return;
				stopWaiting();
				redraw();
			});
			showObserver.observe(element);
		}
	});

	return () => {
		stopWaiting();
		emitter.offref(ref);
	};
}
