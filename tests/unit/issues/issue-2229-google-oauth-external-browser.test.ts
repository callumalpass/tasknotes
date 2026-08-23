const mockOpenExternal = jest.fn();

jest.mock("obsidian", () => ({
	Platform: { isDesktopApp: true },
	requestUrl: jest.fn(),
}));

jest.mock(
	"electron",
	() => ({
		shell: {
			openExternal: mockOpenExternal,
		},
	}),
	{ virtual: true }
);

import { OAuthService } from "../../../src/services/OAuthService";
import { OAuthSecretStore } from "../../../src/services/OAuthSecretStore";
import type TaskNotesPlugin from "../../../src/main";
import type { OAuthConfig, OAuthProvider, OAuthTokens } from "../../../src/types";

class InMemorySecretStorage {
	private readonly values = new Map<string, string>();

	getSecret(id: string): string | null {
		return this.values.get(id) ?? null;
	}

	setSecret(id: string, value: string): void {
		this.values.set(id, value);
	}
}

type OAuthServiceInternals = OAuthService & {
	findAvailablePort: jest.Mock<Promise<number>, [number, number]>;
	startCallbackServer: jest.Mock<Promise<void>, [number]>;
	stopCallbackServer: jest.Mock<Promise<void>, []>;
	generateCodeVerifier: jest.Mock<string, []>;
	generateCodeChallenge: jest.Mock<Promise<string>, [string]>;
	generateState: jest.Mock<string, []>;
	buildAuthorizationUrl: jest.Mock<string, [OAuthConfig, string, string]>;
	waitForCallback: jest.Mock<Promise<string>, [string, number]>;
	exchangeCodeForTokens: jest.Mock<Promise<OAuthTokens>, [OAuthConfig, string, string]>;
	storeConnection: jest.Mock<Promise<void>, [OAuthProvider, OAuthTokens]>;
};

function createOAuthService(): { service: OAuthService; authUrl: string } {
	const secretStore = new OAuthSecretStore(new InMemorySecretStorage());
	secretStore.setCredentials("google", {
		clientId: "google-client-id",
		clientSecret: "google-client-secret",
	});
	const service = new OAuthService(
		{
			emitter: {
				trigger: jest.fn(),
			},
		} as unknown as TaskNotesPlugin,
		secretStore
	) as unknown as OAuthServiceInternals;
	const tokens: OAuthTokens = {
		accessToken: "access-token",
		refreshToken: "refresh-token",
		expiresAt: Date.now() + 3600,
		scope: "calendar",
		tokenType: "Bearer",
	};
	const authUrl =
		"https://accounts.google.com/o/oauth2/v2/auth?client_id=google-client-id";

	service.findAvailablePort = jest.fn().mockResolvedValue(18080);
	service.startCallbackServer = jest.fn().mockResolvedValue(undefined);
	service.stopCallbackServer = jest.fn().mockResolvedValue(undefined);
	service.generateCodeVerifier = jest.fn().mockReturnValue("code-verifier");
	service.generateCodeChallenge = jest.fn().mockResolvedValue("code-challenge");
	service.generateState = jest.fn().mockReturnValue("oauth-state");
	service.buildAuthorizationUrl = jest.fn().mockReturnValue(authUrl);
	service.waitForCallback = jest.fn().mockResolvedValue("authorization-code");
	service.exchangeCodeForTokens = jest.fn().mockResolvedValue(tokens);
	service.storeConnection = jest.fn().mockResolvedValue(undefined);

	return { service, authUrl };
}

describe("Issue #2229: Google OAuth opens outside Obsidian Web Viewer", () => {
	let windowOpenSpy: jest.SpyInstance<Window | null, Parameters<Window["open"]>>;

	beforeEach(() => {
		jest.clearAllMocks();
		windowOpenSpy = jest.spyOn(window, "open").mockImplementation(() => null);
	});

	afterEach(() => {
		windowOpenSpy.mockRestore();
	});

	it("uses the system browser for the OAuth authorization URL", async () => {
		mockOpenExternal.mockResolvedValue(undefined);
		const { service, authUrl } = createOAuthService();

		await service.authenticate("google");

		expect(mockOpenExternal).toHaveBeenCalledWith(authUrl);
		expect(windowOpenSpy).not.toHaveBeenCalled();
	});

	it("falls back to the existing window.open path when external launch fails", async () => {
		mockOpenExternal.mockRejectedValue(new Error("external launch unavailable"));
		const { service, authUrl } = createOAuthService();

		await service.authenticate("google");

		expect(mockOpenExternal).toHaveBeenCalledWith(authUrl);
		expect(windowOpenSpy).toHaveBeenCalledWith(authUrl, "_blank");
	});
});
