import { ICSEvent } from "../types";
import { CalendarProviderRegistry } from "../services/CalendarProvider";
import { ICSSubscriptionService } from "../services/ICSSubscriptionService";

export interface CollectedCalendarEvents {
	events: (ICSEvent & { provider: string })[];
	total: number;
	sources: Record<string, number>;
}

export function isEventInRange(
	event: ICSEvent,
	startDate: Date | null,
	endDate: Date | null
): boolean {
	if (!startDate && !endDate) {
		return true;
	}

	const eventStart = new Date(event.start);
	const eventEnd = event.end ? new Date(event.end) : eventStart;

	if (startDate && eventEnd < startDate) {
		return false;
	}
	if (endDate && eventStart > endDate) {
		return false;
	}

	return true;
}

export function getProviderFromSubscriptionId(subscriptionId: string): string {
	if (subscriptionId.startsWith("google-")) {
		return "google";
	}
	if (subscriptionId.startsWith("microsoft-")) {
		return "microsoft";
	}
	return "unknown";
}

export function collectCalendarEvents(
	providerRegistry: CalendarProviderRegistry,
	icsService: ICSSubscriptionService | null,
	options: { start?: Date | null; end?: Date | null }
): CollectedCalendarEvents {
	const startDate = options.start ?? null;
	const endDate = options.end ?? null;

	const allEvents: (ICSEvent & { provider: string })[] = [];
	const sources: Record<string, number> = {};

	// Events from OAuth providers (Google, Microsoft)
	const providerEvents = providerRegistry.getAllEvents();
	for (const event of providerEvents) {
		const provider = getProviderFromSubscriptionId(event.subscriptionId);
		if (isEventInRange(event, startDate, endDate)) {
			allEvents.push({ ...event, provider });
			sources[provider] = (sources[provider] || 0) + 1;
		}
	}

	// Events from ICS subscriptions
	if (icsService) {
		const icsEvents = icsService.getAllEvents();
		for (const event of icsEvents) {
			if (isEventInRange(event, startDate, endDate)) {
				allEvents.push({ ...event, provider: "ics" });
				sources["ics"] = (sources["ics"] || 0) + 1;
			}
		}
	}

	// Sort events by start time
	allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

	return {
		events: allEvents,
		total: allEvents.length,
		sources,
	};
}
