/**
 * Issue #1485: Google calendar refresh should not report success after token failure.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1485
 */

import { Notice, requestUrl } from "obsidian";

import { GoogleCalendarService } from "../../../src/services/GoogleCalendarService";
import type { OAuthService } from "../../../src/services/OAuthService";
import type TaskNotesPlugin from "../../../src/main";

jest.mock("obsidian", () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	Platform: { isDesktopApp: true },
}));

describe("Issue #1485: Google calendar refresh failure propagation", () => {
	it("rejects manual refresh when Google token refresh fails", async () => {
		const plugin = {
			settings: {
				enabledGoogleCalendars: [],
				googleCalendarSyncTokens: {},
			},
			saveSettings: jest.fn().mockResolvedValue(undefined),
		} as unknown as TaskNotesPlugin;

		const oauthService = {
			isConnected: jest.fn().mockResolvedValue(true),
			getValidToken: jest
				.fn()
				.mockRejectedValue(
					new Error("Failed to refresh google token: Request failed, status 400")
				),
		} as unknown as OAuthService;

		const service = new GoogleCalendarService(plugin, oauthService);

		await expect(service.refresh()).rejects.toThrow("Failed to refresh google token");
		expect(requestUrl).not.toHaveBeenCalled();
		expect(Notice).not.toHaveBeenCalledWith("Google calendar refreshed successfully");
	});
});
