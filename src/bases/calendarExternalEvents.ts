import type { EventInput } from "@fullcalendar/core";
import type TaskNotesPlugin from "../main";
import type { ICSEvent } from "../types";
import { createICSEvent } from "./calendar-core";

export type ExternalCalendarProvider = "ics" | "google" | "microsoft";

export type ExternalCalendarEventFactory = (
	event: ICSEvent,
	plugin: TaskNotesPlugin,
	options: { relatedNoteCount?: number }
) => Nullable<EventInput>;

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

export function shouldIncludeExternalCalendarEvent(
	event: Pick<ICSEvent, "subscriptionId">,
	provider: ExternalCalendarProvider,
	toggles?: ReadonlyMap<string, boolean>
): boolean {
	return toggles?.get(getExternalCalendarToggleId(event, provider)) !== false;
}

export function buildExternalCalendarEvents({
	events,
	provider,
	plugin,
	toggles,
	relatedNoteCountsByEventId,
	createEvent = createICSEvent,
}: BuildExternalCalendarEventsInput): EventInput[] {
	const calendarEvents: EventInput[] = [];

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
