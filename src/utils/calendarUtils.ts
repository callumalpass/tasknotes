import { format } from "date-fns/format";
import { getConfiguredVaultTimeZone, parseVaultDateOption } from "./vaultTime";
import { ICSEvent } from "../types";

export interface CollectedCalendarEvents {
	events: (ICSEvent & { provider: string })[];
	total: number;
	sources: Record<string, number>;
}

interface CalendarProviderEventSource {
	getAllEvents(): (ICSEvent & { subscriptionId: string })[];
}

interface ICSCalendarEventSource {
	getAllEvents(): ICSEvent[];
}

export function presentProviderCalendarEvent(event: ICSEvent): ICSEvent {
	if (event.allDay || getConfiguredVaultTimeZone()) return event;
	const local = (value: string) => {
		const date = new Date(value);
		return Number.isFinite(date.getTime()) ? format(date, "yyyy-MM-dd'T'HH:mm:ss") : value;
	};
	return { ...event, start: local(event.start), end: event.end ? local(event.end) : undefined };
}

export function isEventInRange(
	event: ICSEvent,
	startDate: Date | null,
	endDate: Date | null
): boolean {
	if (!startDate && !endDate) {
		return true;
	}

	const eventStart = parseVaultDateOption(event.start);
	const eventEnd = event.end ? parseVaultDateOption(event.end) : eventStart;

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
	providerRegistry: CalendarProviderEventSource,
	icsService: ICSCalendarEventSource | null,
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
	allEvents.sort((a, b) => parseVaultDateOption(a.start).getTime() - parseVaultDateOption(b.start).getTime());

	return {
		events: allEvents,
		total: allEvents.length,
		sources,
	};
}
