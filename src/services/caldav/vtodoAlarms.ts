/**
 * TaskNotes reminders as iCalendar `VALARM` components (RFC 5545 §3.6.6).
 *
 * The guiding constraint is that TaskNotes is not the only client writing to a
 * VTODO. An alarm set in Nextcloud Tasks or Apple Reminders must survive every
 * push, so ownership is explicit: TaskNotes stamps the alarms it writes with
 * `X-TASKNOTES-REMINDER` and rewrites only those. An untagged VALARM is never
 * matched, never rewritten and never dropped.
 *
 * Round-tripping the reminder id in that stamp also keeps reminder identity
 * stable, so an edit updates an alarm instead of replacing it with a new one.
 *
 * Pure: no Obsidian runtime, no network, no DOM or timer globals.
 */

import type { Reminder } from "../../types";
import { isoToIcsUtcStamp } from "./icsDateValue";
import {
	escapeText,
	getComponents,
	parseContentLine,
	replaceComponents,
	serializeContentLine,
	unescapeText,
	type VTodoDocument,
} from "./vtodoDocument";

/** Marks a VALARM as written by TaskNotes, and carries the reminder id back. */
export const REMINDER_STAMP = "X-TASKNOTES-REMINDER";

const DEFAULT_DESCRIPTION = "Reminder";

/** True for alarms TaskNotes wrote, and only those. */
export function ownsAlarm(lines: readonly string[]): boolean {
	return lines.some((line) => parseContentLine(line)?.name === REMINDER_STAMP);
}

/**
 * Builds the VALARM lines for one reminder.
 *
 * A relative reminder anchors to the task's due date via `RELATED=END` or its
 * scheduled date via `RELATED=START`, which is how DUE and DTSTART are already
 * mapped. An absolute one carries a UTC timestamp instead.
 */
export function reminderToAlarmLines(reminder: Reminder): string[] | null {
	const trigger = triggerFor(reminder);
	if (!trigger) return null;

	const description = reminder.description?.trim() || DEFAULT_DESCRIPTION;
	return [
		"BEGIN:VALARM",
		"ACTION:DISPLAY",
		serializeContentLine({
			name: "DESCRIPTION",
			params: {},
			value: escapeText(description),
		}),
		serializeContentLine(trigger),
		serializeContentLine({
			name: REMINDER_STAMP,
			params: {},
			value: escapeText(reminder.id),
		}),
		"END:VALARM",
	];
}

function triggerFor(
	reminder: Reminder
): { name: string; params: Record<string, string>; value: string } | null {
	if (reminder.type === "absolute") {
		const stamp = reminder.absoluteTime ? isoToIcsUtcStamp(reminder.absoluteTime) : null;
		if (!stamp) return null;
		return { name: "TRIGGER", params: { VALUE: "DATE-TIME" }, value: stamp };
	}

	const offset = reminder.offset?.trim();
	if (!offset) return null;
	// Anything but "scheduled" anchors to the due date, matching the default the
	// reminder UI applies when no anchor was chosen.
	const related = reminder.relatedTo === "scheduled" ? "START" : "END";
	return { name: "TRIGGER", params: { RELATED: related }, value: offset };
}

/** Reads back the reminders TaskNotes wrote, ignoring foreign alarms. */
export function readReminders(doc: VTodoDocument): Reminder[] {
	const reminders: Reminder[] = [];

	for (const lines of getComponents(doc, "VALARM")) {
		if (!ownsAlarm(lines)) continue;

		const properties = lines
			.map((line) => parseContentLine(line))
			.filter((property): property is NonNullable<typeof property> => property !== null);

		const id = properties.find((property) => property.name === REMINDER_STAMP)?.value;
		const trigger = properties.find((property) => property.name === "TRIGGER");
		if (!id || !trigger) continue;

		const description = properties.find((property) => property.name === "DESCRIPTION")?.value;
		const reminder = toReminder(unescapeText(id), trigger);
		if (!reminder) continue;
		if (description) reminder.description = unescapeText(description);

		reminders.push(reminder);
	}

	return reminders;
}

function toReminder(
	id: string,
	trigger: { params: Record<string, string>; value: string }
): Reminder | null {
	const value = trigger.value.trim();
	if (!value) return null;

	// A DATE-TIME trigger is absolute; a duration is relative. Servers may omit
	// VALUE=DATE-TIME, so the value's own shape is the reliable signal.
	if (/^\d{8}T\d{6}Z?$/u.test(value)) {
		const iso = icsStampToIso(value);
		return iso ? { id, type: "absolute", absoluteTime: iso } : null;
	}

	if (!/^[+-]?P/u.test(value)) return null;
	return {
		id,
		type: "relative",
		relatedTo: trigger.params.RELATED?.toUpperCase() === "START" ? "scheduled" : "due",
		offset: value,
	};
}

function icsStampToIso(stamp: string): string | null {
	const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/u.exec(stamp);
	if (!match) return null;
	const [, year, month, day, hour, minute, second, zulu] = match;
	return `${year}-${month}-${day}T${hour}:${minute}:${second}${zulu ? "Z" : ""}`;
}

/**
 * Writes the task's reminders, leaving alarms TaskNotes did not create alone.
 *
 * Passing an empty list removes the tagged alarms, which is what an edit that
 * clears every reminder should do.
 */
export function applyReminders(doc: VTodoDocument, reminders: readonly Reminder[]): void {
	const replacements = reminders
		.map((reminder) => reminderToAlarmLines(reminder))
		.filter((lines): lines is string[] => lines !== null);

	replaceComponents(doc, "VALARM", ownsAlarm, replacements);
}
