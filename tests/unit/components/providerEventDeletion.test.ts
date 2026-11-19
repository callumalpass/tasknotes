import { createI18nService } from "../../../src/i18n";
import {
	CalendarProvider,
	CalendarProviderRegistry,
	type ProviderCalendar,
} from "../../../src/services/CalendarProvider";
import { EventNotFoundError } from "../../../src/services/errors";
import {
	deleteProviderEvent,
	getDeletingProvider,
} from "../../../src/components/providerEventDeletion";
import type TaskNotesPlugin from "../../../src/main";
import type { ICSEvent } from "../../../src/types";

class FakeCalendarProvider extends CalendarProvider {
	constructor(
		readonly providerId = "google",
		readonly providerName = "Google Calendar"
	) {
		super();
	}

	calendars: ProviderCalendar[] = [];
	deleteEvent = jest.fn(async (_calendarId: string, _eventId: string) => undefined);
	refresh = jest.fn(async () => undefined);
	initialize = jest.fn();
	listCalendars = jest.fn();
	getAllEvents = () => [];
	getAvailableCalendars = () => this.calendars;
	updateEvent = jest.fn();
	createEvent = jest.fn();
	createCalendar = jest.fn();
	clearCache = jest.fn();
	destroy = jest.fn();
}

function setup(provider = new FakeCalendarProvider()) {
	const registry = new CalendarProviderRegistry();
	registry.register(provider);
	const plugin = {
		calendarProviderRegistry: registry,
		i18n: createI18nService(),
	} as unknown as TaskNotesPlugin;
	return { provider, plugin };
}

const occurrence: ICSEvent = {
	id: "google-team@example.com-abc_20261114T090000Z",
	subscriptionId: "google-team@example.com",
	title: "Standup",
	start: "2026-11-14T09:00:00Z",
	allDay: false,
	recurringEventId: "google-team@example.com-abc",
};

describe("provider event deletion (#2542)", () => {
	it("offers deletion only for provider events on calendars the account can edit", () => {
		const { provider, plugin } = setup();
		expect(getDeletingProvider(plugin, occurrence)).toBe(provider);

		provider.calendars = [{ id: "team@example.com", summary: "Team", canWrite: false }];
		expect(getDeletingProvider(plugin, occurrence)).toBeUndefined();

		const icsSubscriptionEvent = { ...occurrence, id: "sub-1-x", subscriptionId: "sub-1" };
		expect(getDeletingProvider(plugin, icsSubscriptionEvent)).toBeUndefined();
	});

	it("resolves primary-calendar permissions through the v5 canWrite contract", () => {
		const { provider, plugin } = setup();
		const primaryEvent = { ...occurrence, id: "google-primary-abc", subscriptionId: "google-primary" };
		provider.calendars = [{ id: "team@example.com", summary: "Team", primary: true, canWrite: false }];
		expect(getDeletingProvider(plugin, primaryEvent)).toBeUndefined();

		provider.calendars[0].canWrite = true;
		expect(getDeletingProvider(plugin, primaryEvent)).toBe(provider);
	});

	it("uses the active Google source after the provider registry replaces it", () => {
		const { plugin } = setup();
		const hosted = new FakeCalendarProvider();
		hosted.calendars = [{ id: "team@example.com", summary: "Team", canWrite: false }];
		plugin.calendarProviderRegistry.register(hosted);
		expect(getDeletingProvider(plugin, occurrence)).toBeUndefined();

		hosted.calendars[0].canWrite = true;
		expect(getDeletingProvider(plugin, occurrence)).toBe(hosted);
	});

	it("deletes only the clicked occurrence of a recurring event after confirmation", async () => {
		const { provider, plugin } = setup();
		const confirm = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		const notify = jest.fn();

		await expect(deleteProviderEvent({ plugin, icsEvent: occurrence, confirm, notify })).resolves.toBe(false);
		expect(provider.deleteEvent).not.toHaveBeenCalled();

		await expect(deleteProviderEvent({ plugin, icsEvent: occurrence, confirm, notify })).resolves.toBe(true);
		expect(confirm.mock.calls[0][0].message).toContain("occurrence");
		expect(confirm.mock.calls[0][0].isDestructive).toBe(true);
		expect(provider.deleteEvent).toHaveBeenCalledWith("team@example.com", "abc_20261114T090000Z");
	});

	it("deletes Microsoft occurrences through the same permission and confirmation contract", async () => {
		const { provider, plugin } = setup(new FakeCalendarProvider("microsoft", "Microsoft Calendar"));
		const microsoftOccurrence = {
			...occurrence,
			id: "microsoft-AAMk-TEAM-AA-instance",
			subscriptionId: "microsoft-AAMk-TEAM",
			recurringEventId: "microsoft-AAMk-TEAM-AA-series",
		};
		const confirm = jest.fn().mockResolvedValue(true);
		const notify = jest.fn();
		provider.calendars = [{ id: "AAMk-TEAM", summary: "Team", canWrite: false }];
		await expect(deleteProviderEvent({ plugin, icsEvent: microsoftOccurrence, confirm, notify })).resolves.toBe(false);
		expect(confirm).not.toHaveBeenCalled();

		provider.calendars[0].canWrite = true;
		await expect(deleteProviderEvent({ plugin, icsEvent: microsoftOccurrence, confirm, notify })).resolves.toBe(true);
		expect(confirm.mock.calls[0][0].message).toContain("Microsoft Calendar");
		expect(provider.deleteEvent).toHaveBeenCalledWith("AAMk-TEAM", "AA-instance");
	});

	it("treats an already-deleted event as deleted and reports other failures", async () => {
		const { provider, plugin } = setup();
		const confirm = jest.fn().mockResolvedValue(true);
		const notify = jest.fn();

		provider.deleteEvent.mockRejectedValueOnce(new EventNotFoundError("abc"));
		await expect(deleteProviderEvent({ plugin, icsEvent: occurrence, confirm, notify })).resolves.toBe(true);
		expect(provider.refresh).toHaveBeenCalled();

		provider.deleteEvent.mockRejectedValueOnce(new Error("boom"));
		await expect(deleteProviderEvent({ plugin, icsEvent: occurrence, confirm, notify })).resolves.toBe(false);
		expect(notify).toHaveBeenLastCalledWith(expect.stringContaining("boom"));
	});
});
