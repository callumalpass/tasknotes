import type { ICSEvent, TaskInfo } from "../types";

type EventWithTaskInfo = {
	extendedProps?: {
		taskInfo?: Pick<TaskInfo, "googleCalendarEventId">;
	};
};

export function getDisplayedTaskLinkedGoogleEventIds(
	taskEvents: EventWithTaskInfo[]
): Set<string> {
	const eventIds = new Set<string>();

	for (const event of taskEvents) {
		const eventId = event.extendedProps?.taskInfo?.googleCalendarEventId;
		if (typeof eventId === "string" && eventId.length > 0) {
			eventIds.add(eventId);
		}
	}

	return eventIds;
}

export function getGoogleProviderEventId(
	icsEvent: Pick<ICSEvent, "id" | "subscriptionId">
): string | null {
	if (!icsEvent.subscriptionId.startsWith("google-")) {
		return null;
	}

	const providerPrefix = `${icsEvent.subscriptionId}-`;
	return icsEvent.id.startsWith(providerPrefix)
		? icsEvent.id.slice(providerPrefix.length)
		: icsEvent.id;
}

export function isDisplayedTaskLinkedGoogleEvent(
	icsEvent: Pick<ICSEvent, "id" | "subscriptionId">,
	displayedTaskGoogleEventIds: Set<string>
): boolean {
	if (displayedTaskGoogleEventIds.has(icsEvent.id)) {
		return true;
	}

	const providerEventId = getGoogleProviderEventId(icsEvent);
	return providerEventId !== null && displayedTaskGoogleEventIds.has(providerEventId);
}
