import { requestUrl } from "obsidian";
import type TaskNotesPlugin from "../../../src/main";
import { GoogleCalendarService } from "../../../src/services/GoogleCalendarService";
import type { OAuthService } from "../../../src/services/OAuthService";

jest.mock("obsidian", () => ({
	Platform: { isDesktopApp: true },
	requestUrl: jest.fn(),
}));

describe("issue #2152 Google Calendar paginated event fetch", () => {
	it("preserves full-sync query parameters when requesting the second page", async () => {
		const plugin = {
			settings: {
				enabledGoogleCalendars: [],
				googleCalendarSyncTokens: {},
			},
			saveSettingsDataOnly: jest.fn().mockResolvedValue(undefined),
		} as unknown as TaskNotesPlugin;

		const oauthService = {
			getValidToken: jest.fn().mockResolvedValue("access-token"),
		} as unknown as OAuthService;

		const requestMock = requestUrl as jest.MockedFunction<typeof requestUrl>;
		requestMock
			.mockResolvedValueOnce({
				status: 200,
				json: {
					items: [{ id: "event-1", summary: "First page" }],
					nextPageToken: "second-page-token",
				},
				text: "",
				arrayBuffer: new ArrayBuffer(0),
				headers: {},
			})
			.mockResolvedValueOnce({
				status: 200,
				json: {
					items: [{ id: "event-2", summary: "Second page" }],
					nextSyncToken: "next-sync-token",
				},
				text: "",
				arrayBuffer: new ArrayBuffer(0),
				headers: {},
			});

		const service = new GoogleCalendarService(plugin, oauthService);
		const timeMin = new Date("2026-01-01T00:00:00.000Z");
		const timeMax = new Date("2026-04-01T00:00:00.000Z");

		await service.fetchCalendarEvents(
			"secondary@group.calendar.google.com",
			timeMin,
			timeMax
		);

		expect(requestMock).toHaveBeenCalledTimes(2);
		const firstPageParams = new URL(requestMock.mock.calls[0][0].url).searchParams;
		const secondPageParams = new URL(requestMock.mock.calls[1][0].url).searchParams;

		expect(firstPageParams.get("timeMin")).toBe("2026-01-01T00:00:00.000Z");
		expect(firstPageParams.get("timeMax")).toBe("2026-04-01T00:00:00.000Z");
		expect(firstPageParams.get("orderBy")).toBe("startTime");

		expect(secondPageParams.get("pageToken")).toBe("second-page-token");
		expect(secondPageParams.get("timeMin")).toBe("2026-01-01T00:00:00.000Z");
		expect(secondPageParams.get("timeMax")).toBe("2026-04-01T00:00:00.000Z");
		expect(secondPageParams.get("orderBy")).toBe("startTime");
	});
});
