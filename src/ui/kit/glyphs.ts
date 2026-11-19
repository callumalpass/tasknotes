import { setIcon } from "obsidian";
import { msg } from "@lingui/core/macro";
import { uiText } from "../../i18n/runtime";

const SVG_NS = "http://www.w3.org/2000/svg";
const RING_RADIUS = 6.25;
// The progress pie stops short of the ring, so an in-progress status keeps the open ring's weight.
const PIE_RADIUS = 2;
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
	host.removeAttribute("data-icon");
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

/** Where a ranked priority sits among the configured ones: the top and bottom ranks get their own shape. */
export type PriorityGlyphRank = "top" | "middle" | "bottom";

export type PriorityGlyphState =
	| { kind: "unset" }
	| { kind: "unknown" }
	| { kind: "dot"; rank: PriorityGlyphRank };

interface RankedPriority {
	value: string;
	weight: number;
}

export function hasVisiblePriority(
	_value: string | undefined,
	priorities: readonly RankedPriority[]
): boolean {
	return priorities.length > 0;
}

/**
 * Every ranked priority is a dot in the priority's colour. So that the levels differ by more
 * than colour, the highest weight gets a ring around its dot and the lowest a smaller dot;
 * a single ranked priority is a plain dot. Weight zero is "none" and, like a missing
 * priority, draws an empty ring.
 */
export function priorityGlyphState(
	priorityValue: string | undefined,
	priorities: readonly RankedPriority[]
): PriorityGlyphState {
	const priority = priorityValue
		? priorities.find((candidate) => candidate.value === priorityValue)
		: undefined;
	if (priorityValue && !priority) return { kind: "unknown" };
	if (!priority || priority.weight <= 0) return { kind: "unset" };
	const weights = priorities
		.map((candidate) => candidate.weight)
		.filter((weight) => weight > 0);
	const highest = Math.max(...weights);
	const lowest = Math.min(...weights);
	if (highest === lowest) return { kind: "dot", rank: "middle" };
	if (priority.weight === highest) return { kind: "dot", rank: "top" };
	if (priority.weight === lowest) return { kind: "dot", rank: "bottom" };
	return { kind: "dot", rank: "middle" };
}

export function renderPriorityGlyph(host: HTMLElement, state: PriorityGlyphState): void {
	const root = glyphRoot(host);
	const doc = host.ownerDocument;
	host.dataset.tnGlyph = state.kind;
	if (state.kind === "dot") host.dataset.tnGlyphRank = state.rank;
	else delete host.dataset.tnGlyphRank;
	if (state.kind === "unknown") {
		setIcon(host, "badge-help");
		return;
	}

	if (state.kind === "unset") {
		root.appendChild(
			svgNode(doc, "circle", { cx: 8, cy: 8, r: 3.5, stroke: "currentColor", "stroke-width": 1.25 })
		);
		return;
	}

	const radius = { top: 3.25, middle: 4, bottom: 2.75 }[state.rank];
	root.appendChild(svgNode(doc, "circle", { cx: 8, cy: 8, r: radius, fill: "currentColor" }));
	if (state.rank === "top") {
		root.appendChild(
			svgNode(doc, "circle", { cx: 8, cy: 8, r: 6, stroke: "currentColor", "stroke-width": 1.25 })
		);
	}
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
