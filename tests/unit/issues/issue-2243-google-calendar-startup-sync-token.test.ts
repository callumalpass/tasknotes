/**
 * Issues #2243 / #2553: after an Obsidian restart, Google Calendar views were
 * blank until the user reconnected. Sync tokens are persisted in settings, but
 * the event cache is in memory, so the first refresh after startup must not use
 * an incremental sync that only returns changes since the previous session.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2243
 * @see https://github.com/callumalpass/tasknotes/issues/2553
 */

import { requestUrl } from "obsidian";

import type TaskNotesPlugin from "../../../src/main";
import { GoogleCalendarService } from "../../../src/services/GoogleCalendarService";
import type { OAuthService } from "../../../src/services/OAuthService";

jest.mock("obsidian", () => ({
	requestUrl: jest.fn(),
	Platform: { isDesktopApp: true },
}));

const mockRequestUrl = requestUrl as jest.MockedFunction<typeof requestUrl>;

describe("Issues #2243/#2553: Google Calendar events after restart", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("loads the full event range on the first refresh even when a sync token was saved", async () => {
		const plugin = {
			settings: {
				enabledGoogleCalendars: ["primary"],
				// Saved by the previous Obsidian session.
				googleCalendarSyncTokens: { primary: "previous-session-token" },
			},
			saveSettingsDataOnly: jest.fn().mockResolvedValue(undefined),
		} as unknown as TaskNotesPlugin;
		const oauthService = {
			isConnected: jest.fn().mockResolvedValue(true),
			getValidToken: jest.fn().mockResolvedValue("token"),
		} as unknown as OAuthService;

		const requestedUrls: string[] = [];
		mockRequestUrl.mockImplementation((async (request: { url: string }) => {
			requestedUrls.push(request.url);
			if (request.url.includes("/calendarList")) {
				return { json: { items: [{ id: "primary", summary: "Primary", primary: true }] } };
			}
			const params = new URL(request.url).searchParams;
			if (params.has("syncToken")) {
				// Nothing changed since the last session.
				return { json: { items: [], nextSyncToken: "next-token" } };
			}
			return {
				json: {
					items: [
						{
							id: "event-1",
							status: "confirmed",
							summary: "Existing meeting",
							start: { dateTime: "2026-11-16T09:00:00Z" },
							end: { dateTime: "2026-11-16T10:00:00Z" },
						},
					],
					nextSyncToken: "fresh-token",
				},
			};
		}) as unknown as typeof requestUrl);

		const service = new GoogleCalendarService(plugin, oauthService);
		await service.refreshAllCalendars();

		expect(service.getAllEvents().map((event) => event.title)).toEqual(["Existing meeting"]);
		const eventRequests = requestedUrls.filter((url) => url.includes("/events?"));
		expect(new URL(eventRequests[0]).searchParams.has("syncToken")).toBe(false);
		expect(plugin.settings.googleCalendarSyncTokens.primary).toBe("fresh-token");

		// Later refreshes in the same session stay incremental.
		await service.refreshAllCalendars();
		const laterRequest = requestedUrls.filter((url) => url.includes("/events?")).pop() as string;
		expect(new URL(laterRequest).searchParams.get("syncToken")).toBe("fresh-token");
		expect(service.getAllEvents().map((event) => event.title)).toEqual(["Existing meeting"]);
	});
});
