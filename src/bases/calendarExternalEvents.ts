import type { EventInput } from "@fullcalendar/core";
import type TaskNotesPlugin from "../main";
import type { ICSEvent, TaskInfo } from "../types";
import { createICSEvent } from "./calendar-core";

export type ExternalCalendarProvider = "ics" | "google" | "microsoft";

export type ExternalCalendarEventFactory = (
	event: ICSEvent,
	plugin: TaskNotesPlugin,
	options: { relatedNoteCount?: number }
) => Nullable<EventInput>;

type Nullable<T> = T | null;

/**
 * Predicate that, given an external provider event, reports whether it corresponds
 * to a TaskNotes task that was exported to that provider's calendar. Calendar views
 * use this to suppress the duplicate provider-side rendering of an exported task
 * (upstream issue #1451). Unrelated events must remain visible.
 */
export type LinkedExternalCalendarEventPredicate = (event: ICSEvent) => boolean;

export interface BuildExternalCalendarEventsInput {
	events: readonly ICSEvent[];
	provider: ExternalCalendarProvider;
	plugin: TaskNotesPlugin;
	toggles?: ReadonlyMap<string, boolean>;
	relatedNoteCountsByEventId?: ReadonlyMap<string, number>;
	createEvent?: ExternalCalendarEventFactory;
	/**
	 * Optional predicate that flags provider events linked to an exported
	 * TaskNotes task. Linked events are filtered out so the calendar only
	 * renders the task-side representation.
	 */
	isLinkedToTask?: LinkedExternalCalendarEventPredicate;
}

export function getExternalCalendarToggleId(
	event: Pick<ICSEvent, "subscriptionId">,
	provider: ExternalCalendarProvider
): string {
	if (provider === "google") {
		return event.subscriptionId.replace("google-", "");
	}
	if (provider === "microsoft") {
		return event.subscriptionId.replace("microsoft-", "");
	}
	return event.subscriptionId;
}

export function shouldIncludeExternalCalendarEvent(
	event: Pick<ICSEvent, "subscriptionId">,
	provider: ExternalCalendarProvider,
	toggles?: ReadonlyMap<string, boolean>
): boolean {
	return toggles?.get(getExternalCalendarToggleId(event, provider)) !== false;
}

/**
 * Strip the provider-prefixed event id back down to the raw provider event id.
 *
 * Google/Microsoft ICSEvent ids are normalized as `{provider}-{calendarId}-{rawEventId}`
 * (see GoogleCalendarService/MicrosoftCalendarService). Calendar ids may themselves
 * contain hyphens, so only the known `{provider}-` segment is stripped from the
 * subscription id before removing that calendar-id prefix from the event id.
 */
function getRawProviderEventId(event: ICSEvent, provider: ExternalCalendarProvider): string {
	if (provider !== "google" && provider !== "microsoft") {
		return event.id;
	}
	const calendarId =
		provider === "google"
			? event.subscriptionId.replace("google-", "")
			: event.subscriptionId.replace("microsoft-", "");
	const prefix = `${provider}-${calendarId}-`;
	return event.id.startsWith(prefix) ? event.id.slice(prefix.length) : event.id;
}

function getRawRecurringEventId(
	event: ICSEvent,
	provider: ExternalCalendarProvider
): string | undefined {
	if (!event.recurringEventId) return undefined;
	if (provider !== "google" && provider !== "microsoft") {
		return event.recurringEventId;
	}
	const calendarId =
		provider === "google"
			? event.subscriptionId.replace("google-", "")
			: event.subscriptionId.replace("microsoft-", "");
	const prefix = `${provider}-${calendarId}-`;
	return event.recurringEventId.startsWith(prefix)
		? event.recurringEventId.slice(prefix.length)
		: event.recurringEventId;
}

/**
 * Build a predicate that identifies Google Calendar provider events which are the
 * provider-side mirror of a TaskNotes task exported to Google Calendar.
 *
 * A task is linked to a Google event when, for the export target calendar:
 *  - the task's stored `googleCalendarEventId` equals the event's raw id (single
 *    event or recurring series master), or
 *  - the task's stored `googleCalendarExceptionEventId` equals the event's raw
 *    id (a detached/moved recurring occurrence), or
 *  - the event is an expanded instance of a recurring series whose master id
 *    equals the task's `googleCalendarEventId` (matched via the event's
 *    `recurringEventId`).
 *
 * Only events from the configured export target calendar are considered, so events
 * from other Google calendars are always retained. Microsoft Calendar has no
 * task-export mapping field today, so this helper returns a never-match predicate
 * for the "microsoft" provider; the structure is in place to add Microsoft
 * filtering if a mapping field is introduced.
 */
export function buildLinkedExternalCalendarEventPredicate(
	tasks: readonly TaskInfo[],
	provider: ExternalCalendarProvider,
	plugin: TaskNotesPlugin
): LinkedExternalCalendarEventPredicate {
	if (provider !== "google") {
		return () => false;
	}

	const targetCalendarId = plugin.settings?.googleCalendarExport?.targetCalendarId ?? "";

	const masterEventIds = new Set<string>();
	const exceptionEventIds = new Set<string>();
	for (const task of tasks) {
		if (task.googleCalendarEventId) {
			masterEventIds.add(task.googleCalendarEventId);
		}
		if (task.googleCalendarExceptionEventId) {
			exceptionEventIds.add(task.googleCalendarExceptionEventId);
		}
	}

	if (masterEventIds.size === 0 && exceptionEventIds.size === 0) {
		return () => false;
	}

	return (event: ICSEvent) => {
		if (targetCalendarId === "") {
			return false;
		}
		const calendarId = event.subscriptionId.replace("google-", "");
		if (calendarId !== targetCalendarId) {
			return false;
		}

		const rawEventId = getRawProviderEventId(event, "google");
		if (exceptionEventIds.has(rawEventId)) {
			return true;
		}
		if (masterEventIds.has(rawEventId)) {
			return true;
		}
		const rawRecurringEventId = getRawRecurringEventId(event, "google");
		if (rawRecurringEventId && masterEventIds.has(rawRecurringEventId)) {
			return true;
		}
		return false;
	};
}

export function buildExternalCalendarEvents({
	events,
	provider,
	plugin,
	toggles,
	relatedNoteCountsByEventId,
	createEvent = createICSEvent,
	isLinkedToTask,
}: BuildExternalCalendarEventsInput): EventInput[] {
	const calendarEvents: EventInput[] = [];

	for (const event of events) {
		if (!shouldIncludeExternalCalendarEvent(event, provider, toggles)) {
			continue;
		}

		if (isLinkedToTask?.(event)) {
			continue;
		}

		const calendarEvent = createEvent(event, plugin, {
			relatedNoteCount: relatedNoteCountsByEventId?.get(event.id),
		});
		if (calendarEvent) {
			calendarEvents.push(calendarEvent);
		}
	}

	return calendarEvents;
}
