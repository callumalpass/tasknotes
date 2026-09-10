/**
 * TaskInfo <-> VTODO field mapping.
 *
 * Statuses and priorities in TaskNotes are user-defined strings, while VTODO
 * has four fixed STATUS values and a 1-9 PRIORITY scale, so both directions go
 * through the user's configured `StatusConfig` / `PriorityConfig` lists rather
 * than any hard-coded vocabulary.
 *
 * Fields deliberately NOT mapped, and preserved verbatim instead (see
 * vtodoDocument.ts): DESCRIPTION (the note body is not synced), VALARM,
 * RELATED-TO, ATTACH and every X- property.
 *
 * Pure: no Obsidian runtime, no network, no DOM or timer globals.
 */

import type { PriorityConfig, StatusConfig, TaskInfo } from "../../types";
import {
	formatIcsDateValue,
	icsDateValueToTaskDate,
	icsStampToEpochMs,
	isoToIcsUtcStamp,
	parseIcsDateValue,
	taskDateToIcsDateValue,
	type ZoneToUtc,
} from "./icsDateValue";
import {
	getProperty,
	getTextListProperty,
	getTextProperty,
	removeProperty,
	setProperty,
	setTextListProperty,
	setTextProperty,
	type VTodoDocument,
} from "./vtodoDocument";

export const VTODO_STATUSES = [
	"NEEDS-ACTION",
	"IN-PROCESS",
	"COMPLETED",
	"CANCELLED",
] as const;

export type VTodoStatus = (typeof VTODO_STATUSES)[number];

export interface VTodoMappingContext {
	statuses: StatusConfig[];
	priorities: PriorityConfig[];
	/** Per-status overrides of the auto-derived VTODO status. */
	statusOverrides?: Record<string, VTodoStatus>;
	/** Resolves a TZID wall time to UTC; see icsDateValue.ts. */
	zoneToUtc?: ZoneToUtc;
}

/** The subset of a task that a remote VTODO can dictate. */
export interface VTodoTaskPatch {
	title?: string;
	status?: string;
	priority?: string;
	due?: string | null;
	scheduled?: string | null;
	completedDate?: string | null;
	tags?: string[];
	recurrence?: string | null;
}

export function isVTodoStatus(value: string): value is VTodoStatus {
	return (VTODO_STATUSES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Derives a VTODO status from the flags `StatusConfig` already carries, unless
 * the user has pinned an explicit override for this status value.
 */
export function taskStatusToVTodo(
	statusValue: string,
	context: VTodoMappingContext
): VTodoStatus {
	const override = context.statusOverrides?.[statusValue];
	if (override && isVTodoStatus(override)) return override;

	const config = findStatus(context.statuses, statusValue);
	if (config?.isCompleted) return "COMPLETED";
	if (config?.isSkipped) return "CANCELLED";
	return "NEEDS-ACTION";
}

/**
 * Picks the TaskNotes status that best represents a remote VTODO status.
 *
 * An explicit override wins, so a user who mapped "in-progress" to IN-PROCESS
 * gets that same status back rather than a generic open one.
 */
export function vTodoStatusToTaskStatus(
	vtodoStatus: string,
	context: VTodoMappingContext
): string | undefined {
	const normalized = vtodoStatus?.trim().toUpperCase();
	if (!normalized) return undefined;

	const override = Object.entries(context.statusOverrides ?? {}).find(
		([, mapped]) => mapped === normalized
	)?.[0];
	if (override && findStatus(context.statuses, override)) return override;

	const ordered = [...context.statuses].sort((a, b) => a.order - b.order);
	const open = ordered.filter((status) => !status.isCompleted && !status.isSkipped);

	switch (normalized) {
		case "COMPLETED":
			return ordered.find((status) => status.isCompleted)?.value;
		case "CANCELLED":
			return (
				ordered.find((status) => status.isSkipped)?.value ??
				ordered.find((status) => status.isCompleted)?.value
			);
		case "IN-PROCESS":
			// Without an override there is no way to distinguish in-progress from
			// not-started, so prefer a second open status when one exists.
			return (open[1] ?? open[0] ?? ordered[0])?.value;
		case "NEEDS-ACTION":
			return (open[0] ?? ordered[0])?.value;
		default:
			return undefined;
	}
}

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

/**
 * Spreads the user's priorities across the 1-9 VTODO scale by weight, highest
 * weight to the lowest (most urgent) number. Deterministic in both directions,
 * so a value that leaves TaskNotes comes back as the same priority.
 */
export function taskPriorityToVTodo(
	priorityValue: string,
	context: VTodoMappingContext
): number | undefined {
	const scale = buildPriorityScale(context.priorities);
	return scale.get(priorityValue);
}

export function vTodoPriorityToTaskPriority(
	priority: number | undefined,
	context: VTodoMappingContext
): string | undefined {
	// 0 means "undefined" in RFC 5545.
	if (priority === undefined || priority <= 0 || priority > 9) return undefined;

	const scale = buildPriorityScale(context.priorities);
	let best: { value: string; distance: number } | undefined;
	for (const [value, mapped] of scale) {
		const distance = Math.abs(mapped - priority);
		if (!best || distance < best.distance) best = { value, distance };
	}
	return best?.value;
}

function buildPriorityScale(priorities: PriorityConfig[]): Map<string, number> {
	const scale = new Map<string, number>();
	// A zero-or-negative weight is the "none" priority; RFC 5545 spells that as
	// an absent PRIORITY rather than as 9, which would read as "lowest".
	const ordered = priorities
		.filter((priority) => priority.weight > 0)
		.sort((a, b) => b.weight - a.weight);
	if (ordered.length === 0) return scale;

	if (ordered.length === 1) {
		scale.set(ordered[0].value, 5);
		return scale;
	}

	ordered.forEach((priority, index) => {
		const mapped = Math.round(1 + (index * 8) / (ordered.length - 1));
		scale.set(priority.value, mapped);
	});
	return scale;
}

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

/**
 * TaskNotes stores recurrence as an RRULE with an embedded DTSTART
 * ("DTSTART:20240115;FREQ=WEEKLY"), whereas iCalendar carries DTSTART as its
 * own property. These two helpers move between the forms.
 */
export function splitRecurrence(recurrence: string): {
	dtstart?: string;
	rule: string;
} {
	const match = /DTSTART:(\d{8})(T\d{6}Z?)?;?/u.exec(recurrence);
	if (!match) return { rule: recurrence.replace(/^RRULE:/u, "").trim() };

	const rule = recurrence.replace(match[0], "").replace(/^RRULE:/u, "").trim();
	return { dtstart: `${match[1]}${match[2] ?? ""}`, rule };
}

export function joinRecurrence(dtstartCompact: string | undefined, rule: string): string {
	const cleaned = rule.replace(/^RRULE:/u, "").trim();
	if (!cleaned) return "";
	return dtstartCompact ? `DTSTART:${dtstartCompact};${cleaned}` : cleaned;
}

// ---------------------------------------------------------------------------
// Task -> VTODO
// ---------------------------------------------------------------------------

/**
 * Patches the fields TaskNotes owns onto an existing VTODO, leaving every other
 * line — including VALARM blocks and X- properties — untouched.
 */
export function applyTaskToVTodo(
	doc: VTodoDocument,
	task: TaskInfo,
	context: VTodoMappingContext,
	options: { uid: string; now?: string }
): void {
	const now = options.now ?? new Date().toISOString();

	setTextProperty(doc, "UID", options.uid);
	setTextProperty(doc, "SUMMARY", task.title ?? "");

	writeDate(doc, "DUE", task.due);

	const recurrence = task.recurrence ? splitRecurrence(task.recurrence) : undefined;
	// DTSTART doubles as the recurrence anchor, so a recurring task falls back to
	// the rule's own anchor when it has no scheduled date of its own.
	const scheduled = task.scheduled
		? taskDateToIcsDateValue(task.scheduled)
		: recurrence?.dtstart
			? parseIcsDateValue(recurrence.dtstart)
			: null;

	if (scheduled) {
		const { value, params } = formatIcsDateValue(scheduled);
		setProperty(doc, "DTSTART", value, params);
	} else {
		removeProperty(doc, "DTSTART");
	}

	if (recurrence?.rule) {
		setProperty(doc, "RRULE", recurrence.rule);
	} else {
		removeProperty(doc, "RRULE");
	}

	const status = taskStatusToVTodo(task.status, context);
	setProperty(doc, "STATUS", status);

	if (status === "COMPLETED") {
		const completed = task.completedDate
			? taskDateToIcsDateValue(task.completedDate)
			: null;
		// COMPLETED must be a UTC date-time per RFC 5545, so a date-only
		// completion is anchored at midnight rather than emitted as a DATE.
		const stamp = completed
			? completed.dateOnly
				? `${completed.value.replace(/-/gu, "")}T000000Z`
				: formatIcsDateValue(completed).value
			: isoToIcsUtcStamp(now);
		if (stamp) setProperty(doc, "COMPLETED", stamp);
		setProperty(doc, "PERCENT-COMPLETE", "100");
	} else {
		removeProperty(doc, "COMPLETED");
		removeProperty(doc, "PERCENT-COMPLETE");
	}

	const priority = taskPriorityToVTodo(task.priority, context);
	if (priority === undefined) removeProperty(doc, "PRIORITY");
	else setProperty(doc, "PRIORITY", String(priority));

	setTextListProperty(doc, "CATEGORIES", task.tags ?? []);

	const stamp = isoToIcsUtcStamp(now);
	if (stamp) {
		setProperty(doc, "DTSTAMP", stamp);
		setProperty(doc, "LAST-MODIFIED", stamp);
	}
	bumpSequence(doc);
}

function writeDate(doc: VTodoDocument, name: string, taskDate: string | undefined): void {
	const parsed = taskDate ? taskDateToIcsDateValue(taskDate) : null;
	if (!parsed) {
		removeProperty(doc, name);
		return;
	}
	const { value, params } = formatIcsDateValue(parsed);
	setProperty(doc, name, value, params);
}

function bumpSequence(doc: VTodoDocument): void {
	const current = Number.parseInt(getProperty(doc, "SEQUENCE")?.value ?? "0", 10);
	setProperty(doc, "SEQUENCE", String(Number.isFinite(current) ? current + 1 : 1));
}

// ---------------------------------------------------------------------------
// VTODO -> Task
// ---------------------------------------------------------------------------

export function readVTodoUid(doc: VTodoDocument): string | undefined {
	return getTextProperty(doc, "UID")?.trim() || undefined;
}

/**
 * Epoch milliseconds of the remote's last revision, for the conflict tiebreak.
 *
 * LAST-MODIFIED is preferred where present; RFC 5545 gives DTSTAMP the same
 * meaning for an object held in a calendar store (one with no METHOD property),
 * which is exactly the CalDAV case.
 */
export function readVTodoRevision(doc: VTodoDocument): number | null {
	return (
		icsStampToEpochMs(getProperty(doc, "LAST-MODIFIED")?.value) ??
		icsStampToEpochMs(getProperty(doc, "DTSTAMP")?.value)
	);
}

export function readVTodoIntoTaskPatch(
	doc: VTodoDocument,
	context: VTodoMappingContext
): VTodoTaskPatch {
	const patch: VTodoTaskPatch = {};

	const summary = getTextProperty(doc, "SUMMARY");
	if (summary !== undefined) patch.title = summary;

	patch.due = readDate(doc, "DUE", context) ?? null;

	const dtstart = readDate(doc, "DTSTART", context);
	patch.scheduled = dtstart ?? null;

	const statusProperty = getProperty(doc, "STATUS")?.value;
	const status = statusProperty
		? vTodoStatusToTaskStatus(statusProperty, context)
		: undefined;
	if (status) patch.status = status;

	const completed = readDate(doc, "COMPLETED", context);
	patch.completedDate = completed ? completed.slice(0, 10) : null;

	const priorityRaw = getProperty(doc, "PRIORITY")?.value;
	const priority = priorityRaw
		? vTodoPriorityToTaskPriority(Number.parseInt(priorityRaw, 10), context)
		: undefined;
	if (priority) patch.priority = priority;

	patch.tags = getTextListProperty(doc, "CATEGORIES");

	const rrule = getProperty(doc, "RRULE")?.value?.trim();
	if (rrule) {
		const anchor = getProperty(doc, "DTSTART");
		const anchorValue = anchor
			? parseIcsDateValue(anchor.value, anchor.params)
			: null;
		const compact = anchorValue ? formatIcsDateValue(anchorValue).value : undefined;
		patch.recurrence = joinRecurrence(compact, rrule);
	} else {
		patch.recurrence = null;
	}

	return patch;
}

function readDate(
	doc: VTodoDocument,
	name: string,
	context: VTodoMappingContext
): string | undefined {
	const property = getProperty(doc, name);
	if (!property) return undefined;

	const parsed = parseIcsDateValue(property.value, property.params);
	if (!parsed) return undefined;

	return icsDateValueToTaskDate(parsed, context.zoneToUtc) ?? undefined;
}

function findStatus(statuses: StatusConfig[], value: string): StatusConfig | undefined {
	return statuses.find((status) => status.value === value);
}
