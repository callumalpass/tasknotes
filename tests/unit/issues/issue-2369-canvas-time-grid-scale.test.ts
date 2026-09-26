import { PositionCache } from "@fullcalendar/core/internal";
import { TimeColsSlatsCoords } from "@fullcalendar/timegrid/internal";
import {
	getCanvasTimeGridScale,
	installCanvasTimeGridScaleCorrection,
} from "../../../src/bases/calendarCanvasScale";

function makeCoords(scale: number, inCanvas = true): TimeColsSlatsCoords {
	const root = document.createElement("div");
	root.className = inCanvas ? "canvas-node" : "markdown-preview-view";
	root.innerHTML = '<div class="advanced-calendar-view"><div class="slots"><div class="slat"></div></div></div>';
	const origin = root.querySelector<HTMLElement>(".slots")!;
	const slat = root.querySelector<HTMLElement>(".slat")!;
	Object.defineProperty(slat, "offsetHeight", { value: 48 });
	origin.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
	slat.getBoundingClientRect = () =>
		({ top: 100, bottom: 100 + 48 * scale, height: 48 * scale } as DOMRect);
	return new TimeColsSlatsCoords(
		new PositionCache(origin, [slat], false, true),
		{ slotMinTime: { milliseconds: 0 } } as never,
		{ milliseconds: 1800000 } as never
	);
}

describe("issue #2369: Canvas zoom and time-grid alignment", () => {
	it("converts viewport slat measurements back to CSS offsets only inside Canvas", () => {
		const release = installCanvasTimeGridScaleCorrection();
		try {
			const duration = { milliseconds: 3600000 } as never;
			const scaled = makeCoords(0.75);
			expect(getCanvasTimeGridScale(scaled)).toBe(0.75);
			expect(scaled.computeTimeTop(duration)).toBe(96);
			// A zoom change must not mix fresh DOM measurements with cached positions.
			scaled.positions.els[0].getBoundingClientRect = () =>
				({ height: 60, top: 100, bottom: 160 } as DOMRect);
			expect(scaled.computeTimeTop(duration)).toBe(96);
			expect(makeCoords(1.25).computeTimeTop(duration)).toBe(96);
			expect(makeCoords(0.75, false).computeTimeTop(duration)).toBe(72);
		} finally {
			release();
		}
	});

	it("retains viewport coordinates for hit detection and restores the original method", () => {
		const original = TimeColsSlatsCoords.prototype.computeTimeTop;
		const releaseA = installCanvasTimeGridScaleCorrection();
		const releaseB = installCanvasTimeGridScaleCorrection();
		const scaled = makeCoords(0.75);
		expect(scaled.positions.tops[0]).toBe(0);
		expect(scaled.positions.getHeight(0)).toBe(36);
		releaseA();
		expect(TimeColsSlatsCoords.prototype.computeTimeTop).not.toBe(original);
		releaseB();
		releaseB();
		expect(TimeColsSlatsCoords.prototype.computeTimeTop).toBe(original);
	});
});
