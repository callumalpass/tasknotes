import { OAuthService } from "../../../src/services/OAuthService";
import type TaskNotesPlugin from "../../../src/main";
import type { OAuthConfig } from "../../../src/types";

jest.mock("obsidian", () => ({
	Platform: { isDesktopApp: true },
	requestUrl: jest.fn(),
}));

type BuildAuthorizationUrl = (
	config: OAuthConfig,
	codeChallenge: string,
	state: string
) => string;

function createOAuthService(): OAuthService {
	return new OAuthService({
		settings: {
			googleOAuthClientId: "",
			googleOAuthClientSecret: "",
			microsoftOAuthClientId: "",
			microsoftOAuthClientSecret: "",
		},
		emitter: {
			trigger: jest.fn(),
		},
	} as unknown as TaskNotesPlugin);
}

function buildUrl(config: OAuthConfig): URL {
	const service = createOAuthService() as unknown as {
		buildAuthorizationUrl: BuildAuthorizationUrl;
	};
	return new URL(service.buildAuthorizationUrl(config, "code-challenge", "oauth-state"));
}

describe("Issue #1964: Microsoft OAuth consent prompt", () => {
	it("does not force Microsoft consent on every authorization request", () => {
		const url = buildUrl({
			provider: "microsoft",
			clientId: "microsoft-client-id",
			redirectUri: "http://127.0.0.1:8080",
			scope: ["Calendars.Read", "Calendars.ReadWrite", "offline_access"],
			authorizationEndpoint:
				"https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
			tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
		});

		expect(url.searchParams.get("prompt")).toBeNull();
		expect(url.searchParams.get("access_type")).toBeNull();
		expect(url.searchParams.get("scope")).toBe(
			"Calendars.Read Calendars.ReadWrite offline_access"
		);
	});

	it("keeps forced consent for Google refresh-token authorization", () => {
		const url = buildUrl({
			provider: "google",
			clientId: "google-client-id",
			redirectUri: "http://127.0.0.1:8080",
			scope: [
				"https://www.googleapis.com/auth/calendar.readonly",
				"https://www.googleapis.com/auth/calendar.events",
			],
			authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
			tokenEndpoint: "https://oauth2.googleapis.com/token",
		});

		expect(url.searchParams.get("prompt")).toBe("consent");
		expect(url.searchParams.get("access_type")).toBe("offline");
	});
});
