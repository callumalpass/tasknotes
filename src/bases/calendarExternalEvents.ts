import type TaskNotesPlugin from "../main";
import type { ICSEvent, TaskInfo } from "../types";
import { createICSEvent, type CalendarEvent } from "./calendar-core";
import { findProviderCalendar, PRIMARY_CALENDAR_ALIAS, ProviderCalendar } from "../services/CalendarProvider";

export type ExternalCalendarProvider = "ics" | "google" | "microsoft";

export type ExternalCalendarEventFactory = (
	event: ICSEvent,
	plugin: TaskNotesPlugin,
	options: { relatedNoteCount?: number }
) => Nullable<CalendarEvent>;

type Nullable<T> = T | null;

export interface BuildExternalCalendarEventsInput {
	events: readonly ICSEvent[];
	provider: ExternalCalendarProvider;
	plugin: TaskNotesPlugin;
	toggles?: ReadonlyMap<string, boolean>;
	relatedNoteCountsByEventId?: ReadonlyMap<string, number>;
	createEvent?: ExternalCalendarEventFactory;
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

/**
 * Registers a provider calendar's visibility toggle. Calendars fetched under the
 * primary alias carry that alias as their calendar id, so the account's own
 * calendar has to answer to both keys for its toggle to take effect.
 */
export function setProviderCalendarToggle(
	toggles: Map<string, boolean>,
	calendar: Pick<ProviderCalendar, "id" | "primary">,
	visible: boolean
): void {
	toggles.set(calendar.id, visible);
	if (calendar.primary) {
		toggles.set(PRIMARY_CALENDAR_ALIAS, visible);
	}
}

export function shouldIncludeExternalCalendarEvent(
	event: Pick<ICSEvent, "subscriptionId">,
	provider: ExternalCalendarProvider,
	toggles?: ReadonlyMap<string, boolean>
): boolean {
	return toggles?.get(getExternalCalendarToggleId(event, provider)) !== false;
}

/**
 * Match only mirrors with a task entry on the same day in this view. In particular,
 * a rendered recurring occurrence must not hide every Google instance in its series.
 */
export function buildLinkedGoogleEventPredicate(
	entries: readonly { task: Pick<TaskInfo, "googleCalendarEventId" | "googleCalendarExceptionEventId">; date: string }[],
	plugin: TaskNotesPlugin
): (event: ICSEvent) => boolean {
	const targetId = plugin.settings?.googleCalendarExport?.targetCalendarId;
	const calendars = plugin.googleCalendarService?.getAvailableCalendars() ?? [];
	const canonicalId = (id: string) => findProviderCalendar(calendars, id)?.id ?? id;
	const datesByEventId = new Map<string, Set<string>>();
	for (const { task, date } of entries) {
		for (const id of [task.googleCalendarEventId, task.googleCalendarExceptionEventId]) {
			if (!id) continue;
			const dates = datesByEventId.get(id) ?? new Set<string>();
			dates.add(date.slice(0, 10));
			datesByEventId.set(id, dates);
		}
	}
	return (event) => {
		if (!targetId || !event.subscriptionId.startsWith("google-")) return false;
		const calendarId = getExternalCalendarToggleId(event, "google");
		if (canonicalId(calendarId) !== canonicalId(targetId)) return false;
		// Calendar ids may contain hyphens: remove the entire known prefix.
		const prefix = `google-${calendarId}-`;
		const rawId = (id: string) => id.startsWith(prefix) ? id.slice(prefix.length) : id;
		return [event.id, event.recurringEventId].some(id =>
			id !== undefined && datesByEventId.get(rawId(id))?.has(event.start.slice(0, 10))
		);
	};
}

export function buildExternalCalendarEvents({
	events,
	provider,
	plugin,
	toggles,
	relatedNoteCountsByEventId,
	createEvent = createICSEvent,
}: BuildExternalCalendarEventsInput): CalendarEvent[] {
	const calendarEvents: CalendarEvent[] = [];

	for (const event of events) {
		if (!shouldIncludeExternalCalendarEvent(event, provider, toggles)) {
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
