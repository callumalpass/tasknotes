import { requestUrl } from "obsidian";
import type TaskNotesPlugin from "../../../src/main";
import { GoogleCalendarService } from "../../../src/services/GoogleCalendarService";
import { findProviderCalendar } from "../../../src/services/CalendarProvider";
import type { OAuthService } from "../../../src/services/OAuthService";

jest.mock("obsidian", () => ({
	Platform: { isDesktopApp: true },
	requestUrl: jest.fn(),
}));

const PRIMARY_CALENDAR = {
	id: "person@example.com",
	summary: "Personal",
	primary: true,
	backgroundColor: "#16a765",
};

function createPlugin(enabledGoogleCalendars: string[]): TaskNotesPlugin {
	return {
		settings: {
			enabledGoogleCalendars,
			googleCalendarSyncTokens: {},
		},
		saveSettingsDataOnly: jest.fn().mockResolvedValue(undefined),
	} as unknown as TaskNotesPlugin;
}

function createOAuthService(): OAuthService {
	return {
		isConnected: jest.fn().mockResolvedValue(true),
		getValidToken: jest.fn().mockResolvedValue("access-token"),
	} as unknown as OAuthService;
}

function mockCalendarResponses(): void {
	const requestMock = requestUrl as jest.MockedFunction<typeof requestUrl>;
	requestMock.mockReset();
	requestMock
		.mockResolvedValueOnce({
			status: 200,
			json: { items: [PRIMARY_CALENDAR] },
			text: "",
			arrayBuffer: new ArrayBuffer(0),
			headers: {},
		})
		.mockResolvedValueOnce({
			status: 200,
			json: {
				items: [
					{
						id: "event-1",
						summary: "Standup",
						start: { date: "2026-09-12" },
						end: { date: "2026-09-13" },
					},
				],
				nextSyncToken: "next-sync-token",
			},
			text: "",
			arrayBuffer: new ArrayBuffer(0),
			headers: {},
		});
}

describe("Google primary calendar alias", () => {
	it("colors events from a calendar enabled through the primary alias", async () => {
		mockCalendarResponses();
		const service = new GoogleCalendarService(createPlugin(["primary"]), createOAuthService());

		await service.refreshAllCalendars();

		const [event] = service.getAllEvents();
		expect(event.color).toBe("#16a765");
	});

	it("keeps alias-configured event ids stable", async () => {
		mockCalendarResponses();
		const service = new GoogleCalendarService(createPlugin(["primary"]), createOAuthService());

		await service.refreshAllCalendars();

		const [event] = service.getAllEvents();
		expect(event.subscriptionId).toBe("google-primary");
		expect(event.id).toBe("google-primary-event-1");
	});

	it("still colors events fetched under a calendar's own id", async () => {
		mockCalendarResponses();
		const service = new GoogleCalendarService(
			createPlugin(["person@example.com"]),
			createOAuthService()
		);

		await service.refreshAllCalendars();

		const [event] = service.getAllEvents();
		expect(event.color).toBe("#16a765");
	});

	it("resolves the primary alias to the account's own calendar", () => {
		const calendars = [{ id: "team@example.com", summary: "Work" }, PRIMARY_CALENDAR];

		expect(findProviderCalendar(calendars, "primary")?.summary).toBe("Personal");
		expect(findProviderCalendar(calendars, "team@example.com")?.summary).toBe("Work");
		expect(findProviderCalendar(calendars, "missing@example.com")).toBeUndefined();
	});

	it("has no primary calendar to resolve when none is marked", () => {
		expect(findProviderCalendar([{ id: "team@example.com" }], "primary")).toBeUndefined();
	});
});
