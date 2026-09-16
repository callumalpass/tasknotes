import ICAL from "ical.js";

function normalizeEmail(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const email = value.trim().replace(/^mailto:/i, "").toLowerCase();
	return /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email) ? email : undefined;
}

/** Personal Google ICS feeds commonly use the owner's email as X-WR-CALNAME.
 * A display name is not an identity: never guess from a guest or organizer.
 */
export function getICSCalendarOwnerEmail(calendar: ICAL.Component): string | undefined {
	return normalizeEmail(calendar.getFirstPropertyValue("x-wr-calname"));
}

/** Undefined means the feed/event does not identify the owner's response.
 * Recurrence overrides may inherit a known response from their master.
 */
export function getICSOwnerDeclined(
	event: ICAL.Component,
	ownerEmail: string | undefined
): boolean | undefined {
	if (!ownerEmail) return undefined;
	const owner = event.getAllProperties("attendee").find(
		(attendee) => normalizeEmail(attendee.getFirstValue()) === ownerEmail
	);
	if (!owner) return undefined;
	const status = owner.getParameter("partstat");
	return typeof status === "string" && status.toUpperCase() === "DECLINED";
}
