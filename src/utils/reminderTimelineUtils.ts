/**
 * Shared timeline types and rendering functions used by both
 * Settings (remindersPropertyCard) and ReminderModal.
 */

import { setIcon } from "obsidian";
import TaskNotesPlugin from "../main";
import { getAnchorDisplayName } from "./dateAnchorUtils";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TimelineMarker {
	label: string;
	offsetHours: number; // negative = before anchor, positive = after
	source: "default" | "global";
	semanticType?: string;
	repeatIntervalHours?: number;
	reminderId: string; // ID for click-to-scroll targeting
}

interface PositionedMarker {
	marker: TimelineMarker;
	pct: number;
}

interface TimelineLayout {
	positioned: PositionedMarker[];
	breaks: number[];
	hasJumps: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIT CONVERSION & FORMATTING
// ═══════════════════════════════════════════════════════════════════════════

export function normalizeToHours(value: number, unit: string): number {
	switch (unit) {
		case "minutes": return value / 60;
		case "days": return value * 24;
		default: return value;
	}
}

export function parseISO8601Offset(offset: string): { value: number; unit: string; direction: string } {
	const match = offset.match(/^(-?)P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
	if (!match) return { value: 0, unit: "hours", direction: "before" };

	const [, sign, days, hours, minutes] = match;
	const direction = sign === "-" ? "before" : "after";

	if (days && parseInt(days) > 0) return { value: parseInt(days), unit: "days", direction };
	if (hours && parseInt(hours) > 0) return { value: parseInt(hours), unit: "hours", direction };
	if (minutes && parseInt(minutes) > 0) return { value: parseInt(minutes), unit: "minutes", direction };
	return { value: 0, unit: "hours", direction: "before" };
}

export function formatShortOffset(value: number, unit: string, direction: string): string {
	if (value === 0) return "At anchor";
	const dir = direction === "before" ? "before" : "after";
	if (unit === "minutes") {
		return value === 1 ? `1 min ${dir}` : `${value} min ${dir}`;
	} else if (unit === "hours") {
		return value === 1 ? `1 hour ${dir}` : `${value} hours ${dir}`;
	} else if (unit === "days") {
		return value === 1 ? `1 day ${dir}` : `${value} days ${dir}`;
	}
	return `${value} ${unit} ${dir}`;
}

function formatTickHuman(hours: number): string {
	if (hours < 1) return `${Math.round(hours * 60)} min`;
	if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
	const days = hours / 24;
	if (days < 7) return days === 1 ? "1 day" : `${Math.round(days)} days`;
	const weeks = days / 7;
	if (weeks <= 4 && Number.isInteger(weeks)) return weeks === 1 ? "1 week" : `${Math.round(weeks)} weeks`;
	const months = days / 30;
	if (months < 12) return months === 1 ? "1 month" : `${Math.round(months)} months`;
	const years = days / 365;
	return years === 1 ? "1 year" : `${+years.toFixed(1)} years`;
}

function chooseTickInterval(maxHours: number): { intervalHours: number; formatTick: (h: number) => string } {
	const targetTicks = 6;
	const idealInterval = maxHours / targetTicks;

	const niceIntervals = [
		0.25, 0.5, 1, 3, 6, 12, 24, 72, 168, 720, 2160, 4380, 8760,
	];

	for (const interval of niceIntervals) {
		if (interval >= idealInterval) {
			return { intervalHours: interval, formatTick: formatTickHuman };
		}
	}
	const fallbackInterval = Math.ceil(idealInterval / 8760) * 8760;
	return { intervalHours: fallbackInterval, formatTick: formatTickHuman };
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT ENGINE
// ═══════════════════════════════════════════════════════════════════════════

function computeTimelineLayout(markers: TimelineMarker[], anchorPct: number, minPct: number, maxPct: number): TimelineLayout {
	const GAP_RATIO = 8;
	const BREAK_WIDTH = 4;

	const positioned: PositionedMarker[] = [];
	const breaks: number[] = [];

	const beforeMarkers = markers.filter(m => m.offsetHours < 0)
		.sort((a, b) => Math.abs(a.offsetHours) - Math.abs(b.offsetHours));
	const afterMarkers = markers.filter(m => m.offsetHours > 0)
		.sort((a, b) => a.offsetHours - b.offsetHours);
	const atAnchor = markers.filter(m => m.offsetHours === 0);

	for (const m of atAnchor) positioned.push({ marker: m, pct: anchorPct });

	layoutSide(beforeMarkers, anchorPct, minPct, "before", GAP_RATIO, BREAK_WIDTH, positioned, breaks);
	layoutSide(afterMarkers, anchorPct, maxPct, "after", GAP_RATIO, BREAK_WIDTH, positioned, breaks);

	return { positioned, breaks, hasJumps: breaks.length > 0 };
}

function layoutSide(
	sorted: TimelineMarker[],
	anchorPct: number,
	edgePct: number,
	side: "before" | "after",
	gapRatio: number,
	breakWidth: number,
	out: PositionedMarker[],
	outBreaks: number[]
): void {
	if (sorted.length === 0) return;

	const absOffsets = sorted.map(m => Math.abs(m.offsetHours));

	const clusters: TimelineMarker[][] = [[sorted[0]]];
	for (let i = 1; i < sorted.length; i++) {
		if (absOffsets[i - 1] > 0 && absOffsets[i] / absOffsets[i - 1] > gapRatio) {
			clusters.push([]);
		}
		clusters[clusters.length - 1].push(sorted[i]);
	}

	if (clusters.length <= 1) {
		const maxOff = Math.max(48, absOffsets[absOffsets.length - 1]) * 1.25;
		for (const m of sorted) {
			const ratio = Math.min(Math.abs(m.offsetHours) / maxOff, 1);
			const pct = side === "before"
				? anchorPct - ratio * Math.abs(anchorPct - edgePct)
				: anchorPct + ratio * Math.abs(edgePct - anchorPct);
			out.push({ marker: m, pct: Math.max(Math.min(anchorPct, edgePct), Math.min(Math.max(anchorPct, edgePct), pct)) });
		}
		return;
	}

	const totalSpace = Math.abs(edgePct - anchorPct);
	const totalBreakSpace = (clusters.length - 1) * breakWidth;
	const spacePerCluster = (totalSpace - totalBreakSpace) / clusters.length;
	const dir = side === "before" ? -1 : 1;

	let cursor = anchorPct;

	for (let ci = 0; ci < clusters.length; ci++) {
		const cluster = clusters[ci];
		const segStart = cursor;
		const segEnd = cursor + dir * spacePerCluster;

		if (cluster.length === 1) {
			out.push({ marker: cluster[0], pct: (segStart + segEnd) / 2 });
		} else {
			const clusterOffsets = cluster.map(m => Math.abs(m.offsetHours));
			const cMin = clusterOffsets[0];
			const cMax = clusterOffsets[clusterOffsets.length - 1];
			const cRange = cMax - cMin || 1;
			for (let i = 0; i < cluster.length; i++) {
				const ratio = (clusterOffsets[i] - cMin) / cRange;
				const padded = 0.15 + ratio * 0.7;
				const pct = segStart + dir * padded * Math.abs(segEnd - segStart);
				out.push({ marker: cluster[i], pct });
			}
		}

		cursor = segEnd;

		if (ci < clusters.length - 1) {
			const breakCenter = cursor + dir * (breakWidth / 2);
			outBreaks.push(breakCenter);
			cursor = cursor + dir * breakWidth;
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERLAP RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

function resolveTimelineLabelOverlaps(area: HTMLElement, anchorLabel: HTMLElement): void {
	const MIN_GAP = 4;

	const aboveLabels: HTMLElement[] = [];
	const belowLabels: HTMLElement[] = [];

	belowLabels.push(anchorLabel);

	const markerEls = area.querySelectorAll<HTMLElement>(".tn-reminder-timeline__marker");
	for (const markerEl of markerEls) {
		const label = markerEl.querySelector<HTMLElement>(".tn-reminder-timeline__marker-label");
		if (!label) continue;
		if (markerEl.classList.contains("tn-reminder-timeline__marker--above")) {
			aboveLabels.push(label);
		} else {
			belowLabels.push(label);
		}
	}

	nudgeLane(aboveLabels, MIN_GAP);
	nudgeLane(belowLabels, MIN_GAP);
}

function nudgeLane(labels: HTMLElement[], minGap: number): void {
	if (labels.length < 2) return;

	const items = labels.map(el => {
		const rect = el.getBoundingClientRect();
		return { el, left: rect.left, right: rect.right, width: rect.width, center: rect.left + rect.width / 2, nudge: 0 };
	}).sort((a, b) => a.center - b.center);

	for (let i = 1; i < items.length; i++) {
		const prev = items[i - 1];
		const curr = items[i];
		const prevRight = prev.right + prev.nudge;
		const currLeft = curr.left + curr.nudge;
		const overlap = prevRight + minGap - currLeft;
		if (overlap > 0) {
			const halfNudge = Math.ceil(overlap / 2);
			prev.nudge -= halfNudge;
			curr.nudge += halfNudge;
		}
	}

	for (let i = 1; i < items.length; i++) {
		const prev = items[i - 1];
		const curr = items[i];
		const prevRight = prev.right + prev.nudge;
		const currLeft = curr.left + curr.nudge;
		const overlap = prevRight + minGap - currLeft;
		if (overlap > 0) {
			curr.nudge += Math.ceil(overlap);
		}
	}

	for (const item of items) {
		if (item.nudge !== 0) {
			item.el.style.transform = `translateX(${item.nudge}px)`;
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// TIME SCALE TICKS
// ═══════════════════════════════════════════════════════════════════════════

function renderTimeScaleTicks(
	area: HTMLElement,
	beforeRange: number,
	afterRange: number,
	anchorPct: number,
	minPct: number,
	maxPct: number
): void {
	const { intervalHours, formatTick } = chooseTickInterval(Math.max(beforeRange, afterRange));
	const MAX_TICKS_PER_SIDE = 10;

	let beforeCount = 0;
	let lastBeforeLabel = "";
	for (let h = intervalHours; h <= beforeRange && beforeCount < MAX_TICKS_PER_SIDE; h += intervalHours) {
		const label = formatTick(h);
		if (label === lastBeforeLabel) continue; // Skip duplicate labels (e.g. rounding 36h and 48h both to "2 days")
		lastBeforeLabel = label;

		const ratio = h / beforeRange;
		const pct = anchorPct - ratio * (anchorPct - minPct);
		if (pct < minPct + 2) continue;

		const tick = area.createDiv({ cls: "tn-reminder-timeline__tick" });
		tick.style.left = `${pct}%`;
		const tickLabel = tick.createDiv({ cls: "tn-reminder-timeline__tick-label" });
		tickLabel.textContent = label;
		beforeCount++;
	}

	let afterCount = 0;
	let lastAfterLabel = "";
	for (let h = intervalHours; h <= afterRange && afterCount < MAX_TICKS_PER_SIDE; h += intervalHours) {
		const label = formatTick(h);
		if (label === lastAfterLabel) continue;
		lastAfterLabel = label;

		const ratio = h / afterRange;
		const pct = anchorPct + ratio * (maxPct - anchorPct);
		if (pct > maxPct - 2) continue;

		const tick = area.createDiv({ cls: "tn-reminder-timeline__tick" });
		tick.style.left = `${pct}%`;
		const tickLabel = tick.createDiv({ cls: "tn-reminder-timeline__tick-label" });
		tickLabel.textContent = label;
		afterCount++;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// SCROLL-TO-CARD (settings-specific, passed as optional callback)
// ═══════════════════════════════════════════════════════════════════════════

export function scrollToReminderCard(scrollContext: HTMLElement, reminderId: string, source: "default" | "global"): void {
	const sectionClass = source === "default" ? "tn-reminders-section--default" : "tn-reminders-section--global";
	const section = scrollContext.querySelector(`.${sectionClass}`);
	if (section?.hasClass("tasknotes-settings__collapsible-section--collapsed")) {
		const header = section.querySelector(".tasknotes-settings__collapsible-section-header") as HTMLElement;
		header?.click();
	}

	const card = scrollContext.querySelector(`[data-card-id="${reminderId}"]`) as HTMLElement;
	if (!card) return;

	if (card.classList.contains("tasknotes-settings__card--collapsed")) {
		const cardHeader = card.querySelector(".tasknotes-settings__card-header") as HTMLElement;
		cardHeader?.click();
	}

	setTimeout(() => {
		card.scrollIntoView({ behavior: "smooth", block: "center" });
		card.addClass("tn-reminder-timeline__flash");
		setTimeout(() => card.removeClass("tn-reminder-timeline__flash"), 1200);
	}, 150);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN RENDER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export function renderTimelineArea(container: HTMLElement, markers: TimelineMarker[], plugin: TaskNotesPlugin, scrollContext?: HTMLElement): void {
	const area = container.createDiv({ cls: "tn-reminder-timeline__area" });

	area.createDiv({ cls: "tn-reminder-timeline__line" });

	const ANCHOR_PCT = 65;
	const MIN_PCT = 5;
	const MAX_PCT = 95;

	const anchor = area.createDiv({ cls: "tn-reminder-timeline__anchor" });
	anchor.style.left = `${ANCHOR_PCT}%`;
	anchor.createDiv({ cls: "tn-reminder-timeline__anchor-line" });
	anchor.createDiv({ cls: "tn-reminder-timeline__anchor-pin" });
	const anchorLabel = anchor.createDiv({ cls: "tn-reminder-timeline__anchor-label" });
	anchorLabel.textContent = getAnchorDisplayName("due", plugin);

	const layout = computeTimelineLayout(markers, ANCHOR_PCT, MIN_PCT, MAX_PCT);

	for (const breakPct of layout.breaks) {
		const breakEl = area.createDiv({ cls: "tn-reminder-timeline__break" });
		breakEl.style.left = `${breakPct}%`;
		breakEl.textContent = "\u22EF";
	}

	for (const { marker, pct } of layout.positioned) {
		const isAbove = marker.source === "default";
		const sideClass = isAbove ? "tn-reminder-timeline__marker--above" : "tn-reminder-timeline__marker--below";

		const markerEl = area.createDiv({ cls: `tn-reminder-timeline__marker ${sideClass}` });
		markerEl.style.left = `${pct}%`;

		const labelEl = markerEl.createDiv({ cls: `tn-reminder-timeline__marker-label tn-reminder-timeline__marker-label--${marker.source}` });
		let labelText = marker.label;
		if (marker.semanticType === "overdue" && marker.repeatIntervalHours) {
			labelText += ` (${marker.repeatIntervalHours}h)`;
		} else if (marker.semanticType === "due-date") {
			labelText += " \u2022";
		}
		labelEl.textContent = labelText;
		labelEl.title = labelText;

		markerEl.createDiv({ cls: `tn-reminder-timeline__marker-stem tn-reminder-timeline__marker-stem--${marker.source}` });

		const dotClasses = [`tn-reminder-timeline__marker-dot`, `tn-reminder-timeline__marker-dot--${marker.source}`];
		if (marker.semanticType === "due-date") dotClasses.push("tn-reminder-timeline__marker-dot--persistent");
		if (marker.semanticType === "overdue") dotClasses.push("tn-reminder-timeline__marker-dot--repeating");
		markerEl.createDiv({ cls: dotClasses.join(" ") });

		if (scrollContext && marker.reminderId) {
			markerEl.style.cursor = "pointer";
			markerEl.title = `${labelText} — click to edit`;
			markerEl.addEventListener("click", () => {
				scrollToReminderCard(scrollContext, marker.reminderId, marker.source);
			});
		}
	}

	if (!layout.hasJumps) {
		const offsets = markers.map(m => Math.abs(m.offsetHours));
		const maxOffset = Math.max(48, ...offsets) * 1.25;
		const beforeRange = maxOffset;
		const afterRange = maxOffset * ((100 - ANCHOR_PCT) / ANCHOR_PCT);
		renderTimeScaleTicks(area, beforeRange, afterRange, ANCHOR_PCT, MIN_PCT, MAX_PCT);
	}

	const dirLabels = container.createDiv({ cls: "tn-reminder-timeline__direction-labels" });
	dirLabels.createSpan({ text: "\u2190 before" });
	dirLabels.createSpan({ text: "after \u2192" });

	requestAnimationFrame(() => {
		requestAnimationFrame(() => resolveTimelineLabelOverlaps(area, anchorLabel));
	});
}
