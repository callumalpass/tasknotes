import { ICSSubscriptionService } from "../../../src/services/ICSSubscriptionService";
import type { ICSCache, ICSEvent, ICSSubscription } from "../../../src/types";

jest.mock("obsidian", () => ({ Notice: jest.fn(), requestUrl: jest.fn(), TFile: jest.fn() }));
jest.mock("ical.js", () => jest.requireActual("../../../node_modules/ical.js/dist/ical.es5.cjs"));

type Internals = {
	subscriptions: ICSSubscription[];
	cache: Map<string, ICSCache>;
	parseICS(data: string, subscriptionId: string): ICSEvent[];
};

describe("PR #1477 - ICS title contains filter", () => {
	let service: ICSSubscriptionService;
	let internals: Internals;
	let subscription: ICSSubscription;

	const event = (title: string, uid?: string) => [
		"BEGIN:VEVENT", ...(uid ? [`UID:${uid}`] : []),
		"DTSTART:20260910T100000Z", `SUMMARY:${title}`, "END:VEVENT",
	];

	function cacheEvents(lines: string[], id = "sub") {
		const events = internals.parseICS(
			["BEGIN:VCALENDAR", "VERSION:2.0", ...lines, "END:VCALENDAR"].join("\r\n"),
			id
		);
		internals.cache.set(id, {
			subscriptionId: id, events,
			lastUpdated: new Date().toISOString(),
			expires: new Date(Date.now() + 3600000).toISOString(),
		});
		return events;
	}

	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(new Date("2026-09-10T00:00:00Z"));
		const plugin = {
			loadPluginDataForSafeWrite: jest.fn().mockResolvedValue({}),
			saveData: jest.fn().mockResolvedValue(undefined),
		};
		service = new ICSSubscriptionService(plugin as unknown as ConstructorParameters<typeof ICSSubscriptionService>[0]);
		internals = service as unknown as Internals;
		subscription = {
			id: "sub", name: "Calendar", type: "remote", enabled: true,
			url: "https://example.com/calendar.ics", color: "#3788d8", refreshInterval: 60,
		};
		internals.subscriptions = [subscription];
	});

	afterEach(() => {
		service.destroy();
		jest.useRealTimers();
	});

	function expectTitles(titles: string[]) {
		expect(service.getAllEvents().map(e => e.title)).toEqual(titles);
		expect(service.getEventsForSubscription("sub").map(e => e.title)).toEqual(titles);
	}

	it("defaults existing subscriptions without a filter to all events", () => {
		cacheEvents([...event("Meeting"), ...event("Lunch")]);
		expectTitles(["Meeting", "Lunch"]);
	});

	it("matches case-insensitive literal substrings and trims the filter", () => {
		subscription.filter = "  MEET  ";
		cacheEvents([...event("Team meeting"), ...event("MEETING"), ...event("Lunch")]);
		expectTitles(["Team meeting", "MEETING"]);
	});

	it.each(["", "   "])("shows all events for an empty filter %j", filter => {
		subscription.filter = filter;
		cacheEvents([...event("Meeting"), ...event("Lunch")]);
		expectTitles(["Meeting", "Lunch"]);
	});

	it.each(["[", "(a+)+$", "/Meeting/g", "/Meeting/y", ".*"])(
		"treats regex syntax/flags literally, including invalid or dangerous patterns: %s",
		filter => {
			subscription.filter = filter;
			cacheEvents([
				...event("Meeting"), ...event("a".repeat(10000) + "!"),
				...event(`Literal ${filter}`), ...event(`Literal ${filter}`),
			]);
			expectTitles([`Literal ${filter}`, `Literal ${filter}`]);
			expectTitles([`Literal ${filter}`, `Literal ${filter}`]);
		}
	);

	it("edits and clears the filter immediately without fetching or changing the full cache or IDs", async () => {
		const events = cacheEvents([...event("Lunch"), ...event("Meeting")]);
		const originalIds = events.map(e => e.id);
		const fetch = jest.spyOn(service, "fetchSubscription").mockResolvedValue();
		const changed = jest.fn(() => service.getAllEvents());
		service.on("data-changed", changed);

		await service.updateSubscription("sub", { filter: "Meeting" });
		expectTitles(["Meeting"]);
		expect(service.getAllEvents()[0].id).toBe(originalIds[1]);
		expect(changed).toHaveLastReturnedWith([events[1]]);

		await service.updateSubscription("sub", { filter: "Lunch" });
		expectTitles(["Lunch"]);
		await service.updateSubscription("sub", { filter: "" });
		expectTitles(["Lunch", "Meeting"]);
		expect(service.getAllEvents().map(e => e.id)).toEqual(originalIds);
		expect(internals.cache.get("sub")!.events).toBe(events);
		expect(fetch).not.toHaveBeenCalled();

		// A later feed refresh also retains UID-less IDs regardless of filtering.
		await service.updateSubscription("sub", { filter: "Meeting" });
		cacheEvents([...event("Lunch"), ...event("Meeting")]);
		expect(service.getAllEvents()[0].id).toBe(originalIds[1]);
	});

	it("matches renamed exceptions on their own title, even when the master does not match", async () => {
		cacheEvents([
			"BEGIN:VEVENT", "UID:series", "DTSTART:20260910T100000Z",
			"RRULE:FREQ=DAILY;COUNT=2", "SUMMARY:Team meeting", "END:VEVENT",
			"BEGIN:VEVENT", "UID:series", "RECURRENCE-ID:20260910T100000Z",
			"DTSTART:20260910T110000Z", "SUMMARY:Lunch", "END:VEVENT",
		]);
		await service.updateSubscription("sub", { filter: "Lunch" });
		expectTitles(["Lunch"]);
		expect(service.getAllEvents()[0]).toMatchObject({
			start: "2026-09-10T11:00:00.000Z", recurringEventId: "sub-series",
		});
		await service.updateSubscription("sub", { filter: "meeting" });
		expectTitles(["Team meeting"]);
		expect(service.getAllEvents()[0].start).toBe("2026-09-11T10:00:00.000Z");
	});

	it("filters each subscription independently without enabling disabled subscriptions", () => {
		subscription.filter = "Meeting";
		internals.subscriptions.push(
			{ ...subscription, id: "other", filter: "Lunch" },
			{ ...subscription, id: "disabled", enabled: false, filter: "" }
		);
		for (const id of ["sub", "other", "disabled"]) {
			cacheEvents([...event("Meeting"), ...event("Lunch")], id);
		}
		expect(service.getAllEvents().map(e => [e.subscriptionId, e.title])).toEqual([
			["sub", "Meeting"], ["other", "Lunch"],
		]);
		expect(service.getEventsForSubscription("other").map(e => e.title)).toEqual(["Lunch"]);
	});

	it("applies the filter to stale cache while the existing background refresh runs", () => {
		cacheEvents([...event("Meeting"), ...event("Lunch")]);
		subscription.filter = "Meeting";
		internals.cache.get("sub")!.expires = new Date(Date.now() - 60000).toISOString();
		const fetch = jest.spyOn(service, "fetchSubscription").mockResolvedValue();
		expectTitles(["Meeting"]);
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});
