import { TimeColsSlatsCoords } from "@fullcalendar/timegrid/internal";

/**
 * FullCalendar measures slats with getBoundingClientRect(), but uses the resulting
 * viewport pixels as CSS offsets for events and the now indicator. Canvas zoom
 * then scales those offsets a second time. Only the rendered offsets need
 * correction: hit detection intentionally uses viewport coordinates.
 */
export function getCanvasTimeGridScale(coords: TimeColsSlatsCoords): number {
	const slat = coords.positions.els[0];
	if (!slat?.closest(".canvas-node .advanced-calendar-view")) return 1;

	const layoutHeight = slat.offsetHeight;
	// Use the measurement captured with this PositionCache, not the current DOM
	// rectangle: Canvas may zoom between cache creation and a calendar re-render.
	const visualHeight = coords.positions.getHeight(0);
	const scale = layoutHeight > 0 ? visualHeight / layoutHeight : 1;
	return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

let subscribers = 0;
let originalComputeTimeTop: TimeColsSlatsCoords["computeTimeTop"] | null = null;

export function installCanvasTimeGridScaleCorrection(): () => void {
	if (subscribers++ === 0) {
		originalComputeTimeTop = Reflect.get(TimeColsSlatsCoords.prototype, "computeTimeTop");
		const computeTimeTop = originalComputeTimeTop;
		TimeColsSlatsCoords.prototype.computeTimeTop = function (duration) {
			return computeTimeTop.call(this, duration) / getCanvasTimeGridScale(this);
		};
	}

	let released = false;
	return () => {
		if (released) return;
		released = true;
		if (--subscribers === 0 && originalComputeTimeTop) {
			TimeColsSlatsCoords.prototype.computeTimeTop = originalComputeTimeTop;
			originalComputeTimeTop = null;
		}
	};
}
