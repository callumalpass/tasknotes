/**
 * Issue #2113: a failed Google Calendar manual refresh should not make the
 * next immediate click look successful because of the manual refresh throttle.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2113
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

describe("Issue #2113: Google Calendar refresh false success after failure", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("does not rate-limit a failed manual refresh as a successful no-op", async () => {
		const plugin = {
			settings: {
				enabledGoogleCalendars: [],
				googleCalendarSyncTokens: {},
			},
		} as unknown as TaskNotesPlugin;
		const oauthService = {
			isConnected: jest.fn().mockResolvedValue(true),
			getValidToken: jest.fn().mockResolvedValue("token"),
		} as unknown as OAuthService;

		const forbiddenError = Object.assign(new Error("Request failed, status 403"), {
			status: 403,
		});
		mockRequestUrl.mockRejectedValue(forbiddenError);

		const service = new GoogleCalendarService(plugin, oauthService);

		await expect(service.refresh()).rejects.toThrow("Request failed, status 403");
		await expect(service.refresh()).rejects.toThrow("Request failed, status 403");

		expect(mockRequestUrl).toHaveBeenCalledTimes(2);
	});
});
