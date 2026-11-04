import { setIcon } from "obsidian";
import { msg } from "@lingui/core/macro";
import { uiText } from "../../i18n/runtime";

const SVG_NS = "http://www.w3.org/2000/svg";
const RING_RADIUS = 6.25;
const PIE_RADIUS = 2.75;
const PIE_CIRCUMFERENCE = 2 * Math.PI * PIE_RADIUS;

type SvgAttributes = Record<string, string | number>;

function svgNode(doc: Document, tag: string, attributes: SvgAttributes): SVGElement {
	const node = doc.createElementNS(SVG_NS, tag);
	for (const [name, value] of Object.entries(attributes)) {
		node.setAttribute(name, String(value));
	}
	return node;
}

function glyphRoot(host: HTMLElement): SVGElement {
	const root = svgNode(host.ownerDocument, "svg", {
		viewBox: "0 0 16 16",
		width: "100%",
		height: "100%",
		fill: "none",
		"aria-hidden": "true",
		class: "tn-glyph",
	});
	host.replaceChildren(root);
	return root;
}

export type StatusGlyphKind = "unset" | "unknown" | "open" | "progress" | "complete" | "skipped";

export interface StatusGlyphState {
	kind: StatusGlyphKind;
	/** 0 to 1. How far through the open workflow this status sits. */
	progress: number;
}

interface WorkflowStatus {
	id?: string;
	value: string;
	isCompleted: boolean;
	isSkipped?: boolean;
	order: number;
}

/** The first open status is an empty ring. Later ones fill towards done. */
export function statusGlyphState(
	statusValue: string,
	statuses: readonly WorkflowStatus[]
): StatusGlyphState {
	const status = statuses.find((candidate) => candidate.value === statusValue);
	if (!status) return { kind: statusValue ? "unknown" : "unset", progress: 0 };
	if (status.isSkipped) return { kind: "skipped", progress: 1 };
	if (status.isCompleted) return { kind: "complete", progress: 1 };
	if (status.id === "none") return { kind: "unset", progress: 0 };

	const open = statuses
		.filter(
			(candidate) => !candidate.isCompleted && !candidate.isSkipped && candidate.id !== "none"
		)
		.sort((a, b) => a.order - b.order);
	const index = open.findIndex((candidate) => candidate.value === statusValue);
	if (index <= 0) return { kind: "open", progress: 0 };
	return { kind: "progress", progress: index / open.length };
}

export function renderStatusGlyph(host: HTMLElement, state: StatusGlyphState): void {
	const root = glyphRoot(host);
	const doc = host.ownerDocument;
	const center = { cx: 8, cy: 8 };
	host.dataset.tnGlyph = state.kind;
	if (state.kind === "unknown") {
		setIcon(host, "circle-help");
		return;
	}

	if (state.kind === "complete" || state.kind === "skipped") {
		root.appendChild(svgNode(doc, "circle", { ...center, r: 7, fill: "currentColor" }));
		root.appendChild(
			svgNode(doc, "path", {
				d:
					state.kind === "complete"
						? "M4.9 8.2l2.1 2.1 4.1-4.5"
						: "M5.5 5.5l5 5M10.5 5.5l-5 5",
				stroke: "var(--background-primary)",
				"stroke-width": 1.6,
				"stroke-linecap": "round",
				"stroke-linejoin": "round",
			})
		);
		return;
	}

	root.appendChild(
		svgNode(doc, "circle", {
			...center,
			r: RING_RADIUS,
			stroke: "currentColor",
			"stroke-width": 1.5,
			...(state.kind === "unset" ? { "stroke-dasharray": "2.4 2.5" } : {}),
		})
	);

	if (state.kind === "progress") {
		root.appendChild(
			svgNode(doc, "circle", {
				...center,
				r: PIE_RADIUS,
				stroke: "currentColor",
				"stroke-width": PIE_RADIUS * 2,
				"stroke-dasharray": `${PIE_CIRCUMFERENCE * state.progress} ${PIE_CIRCUMFERENCE}`,
				transform: "rotate(-90 8 8)",
			})
		);
	}
}

export type PriorityGlyphState =
	| { kind: "unset" }
	| { kind: "unknown" }
	| { kind: "bars"; level: 1 | 2 | 3 }
	| { kind: "top" };

interface RankedPriority {
	value: string;
	weight: number;
}

/**
 * Bars by rank. Workflows with four or more ranked priorities reserve a solid
 * mark for the highest, so three bars stay meaningful below it. Weight zero is "none".
 */
export function priorityGlyphState(
	priorityValue: string | undefined,
	priorities: readonly RankedPriority[]
): PriorityGlyphState {
	if (priorityValue && !priorities.some((priority) => priority.value === priorityValue))
		return { kind: "unknown" };
	const ranked = priorities
		.filter((priority) => priority.weight > 0)
		.sort((a, b) => a.weight - b.weight);
	const index = ranked.findIndex((priority) => priority.value === priorityValue);
	if (index < 0) return { kind: "unset" };

	const reservesTop = ranked.length >= 4;
	if (reservesTop && index === ranked.length - 1) return { kind: "top" };

	const barRanks = reservesTop ? ranked.length - 1 : ranked.length;
	const level = Math.max(1, Math.ceil(((index + 1) / barRanks) * 3));
	return { kind: "bars", level: Math.min(level, 3) as 1 | 2 | 3 };
}

export function renderPriorityGlyph(host: HTMLElement, state: PriorityGlyphState): void {
	const root = glyphRoot(host);
	const doc = host.ownerDocument;
	host.dataset.tnGlyph = state.kind;
	if (state.kind === "unknown") {
		setIcon(host, "badge-help");
		return;
	}

	if (state.kind === "top") {
		root.appendChild(
			svgNode(doc, "rect", {
				x: 1.5,
				y: 1.5,
				width: 13,
				height: 13,
				rx: 3,
				fill: "currentColor",
			})
		);
		root.appendChild(
			svgNode(doc, "path", {
				d: "M8 4.5v4.2M8 11.2v.3",
				stroke: "var(--background-primary)",
				"stroke-width": 1.8,
				"stroke-linecap": "round",
			})
		);
		return;
	}

	if (state.kind === "unset") {
		for (const x of [2.5, 6.75, 11]) {
			root.appendChild(
				svgNode(doc, "rect", {
					x,
					y: 7.25,
					width: 2.5,
					height: 1.5,
					rx: 0.75,
					fill: "currentColor",
				})
			);
		}
		return;
	}

	[
		{ x: 2, y: 9, height: 5 },
		{ x: 6.5, y: 5.5, height: 8.5 },
		{ x: 11, y: 2, height: 12 },
	].forEach((bar, index) => {
		root.appendChild(
			svgNode(doc, "rect", {
				...bar,
				width: 3,
				rx: 1,
				fill: "currentColor",
				opacity: index < state.level ? 1 : 0.25,
			})
		);
	});
}

/** Lucide icon by name, for the rare spot that wants one inside a kit part. */
export function renderIcon(host: HTMLElement, icon: string): void {
	host.replaceChildren();
	setIcon(host, icon);
}

export function unconfiguredValueLabel(value: string): string {
	return uiText(
		msg({ message: "{value} (not configured)", context: "ui.kit.unconfiguredValue" }),
		{ value }
	);
}
