import { describe, expect, it, jest } from "@jest/globals";
import { createICSEventCard, updateICSEventCard } from "../../../src/ui/ICSCard";
import type { ICSEvent } from "../../../src/types";

function createEvent(overrides: Partial<ICSEvent> = {}): ICSEvent {
	return {
		id: "google-primary-event-1",
		subscriptionId: "google-primary",
		title: "Team sync",
		start: "2026-08-03T10:00:00",
		end: "2026-08-03T11:00:00",
		allDay: false,
		...overrides,
	};
}

function createPlugin() {
	const provider = {
		providerName: "Google Calendar",
		extractEventIds: (event: ICSEvent) => ({
			calendarId: event.subscriptionId.replace("google-", ""),
			eventId: event.id,
		}),
		getAvailableCalendars: jest.fn(() => [
			{
				id: "person@example.com",
				summary: "Personal",
				primary: true,
			},
		]),
	};

	return {
		app: {},
		i18n: {
			translate: (key: string) => (key === "ui.icsCard.calendarFallback" ? "Calendar" : key),
		},
		settings: {
			calendarViewSettings: {
				timeFormat: "24",
			},
		},
		icsSubscriptionService: {
			getSubscriptions: () => [],
		},
		calendarProviderRegistry: {
			findProviderForEvent: jest.fn(() => provider),
		},
	};
}

describe("provider calendar source names on ICS cards", () => {
	it("shows a provider calendar name for primary-alias Google events", () => {
		const card = createICSEventCard(createEvent(), createPlugin() as any);

		expect(card.querySelector(".task-card__metadata")?.textContent).toContain("Personal");
		expect(card.querySelector(".task-card__metadata")?.textContent).not.toContain("Calendar");
	});

	it("refreshes the provider calendar name when an existing card updates", () => {
		const plugin = createPlugin();
		const card = createICSEventCard(createEvent(), plugin as any);
		plugin.calendarProviderRegistry.findProviderForEvent.mockReturnValue({
			providerName: "Microsoft Calendar",
			extractEventIds: () => ({ calendarId: "work", eventId: "event-1" }),
			getAvailableCalendars: () => [{ id: "work", summary: "Work" }],
		});

		updateICSEventCard(
			card,
			createEvent({ id: "microsoft-work-event-1", subscriptionId: "microsoft-work" }),
			plugin as any
		);

		expect(card.querySelector(".task-card__metadata")?.textContent).toContain("Work");
		expect(card.querySelector(".task-card__metadata")?.textContent).not.toContain("Personal");
	});

	it("uses the translated fallback when no subscription or provider owns the event", () => {
		const plugin = createPlugin();
		plugin.calendarProviderRegistry.findProviderForEvent.mockReturnValue(undefined);

		const card = createICSEventCard(
			createEvent({ id: "unknown-event", subscriptionId: "unknown" }),
			plugin as any
		);

		expect(card.querySelector(".task-card__metadata")?.textContent).toContain("Calendar");
	});
});
