import { OAuthService } from "../../src/services/OAuthService";
import { OAuthSecretStore } from "../../src/services/OAuthSecretStore";

function createService() {
	const values = new Map<string, string>();
	const store = new OAuthSecretStore({
		getSecret: (key) => values.get(key) ?? null,
		setSecret: (key, value) => { values.set(key, value); },
	});
	store.setCredentials("google", { clientId: "fixture-client" });
	const service: any = new OAuthService({ emitter: { trigger: jest.fn() } } as any, store);
	service.generateCodeChallenge = jest.fn().mockResolvedValue("challenge");
	service.generateState = jest.fn().mockReturnValue("fixture-state");
	service.startCallbackServer = jest.fn().mockResolvedValue(18081);
	service.stopCallbackServer = jest.fn().mockResolvedValue(undefined);
	service.openAuthorizationUrl = jest.fn(() => new Promise(() => {}));
	service.exchangeCodeForTokens = jest.fn().mockResolvedValue({ accessToken: "fixture" });
	service.storeConnection = jest.fn().mockResolvedValue(undefined);
	return service;
}

async function flush() {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("OAuth lifecycle (#2279, #2292)", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it("exchanges a callback and cleans up while the browser-launch promise stays pending", async () => {
		const service = createService();
		const authentication = service.authenticate("google");
		await flush();
		const authUrl = new URL(service.openAuthorizationUrl.mock.calls[0][0]);
		expect(authUrl.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:18081");
		service.exchangeCodeForTokens.mockImplementation(async (config, code) => {
			expect(config.redirectUri).toBe("http://127.0.0.1:18081");
			expect(code).toBe("fixture-code");
			return { accessToken: "fixture" };
		});
		service.handleCallback({ method: "GET", url: "/?state=fixture-state&code=fixture-code", headers: {} }, { writeHead: jest.fn(), end: jest.fn() });
		await authentication;
		expect(service.exchangeCodeForTokens).toHaveBeenCalledTimes(1);
		expect(service.stopCallbackServer).toHaveBeenCalledTimes(1);
		expect(service.pendingOAuthState.size).toBe(0);
		expect(jest.getTimerCount()).toBe(0);
	});

	it("rejects the active authorization and clears its timeout on unload", async () => {
		const service = createService();
		const authentication = service.authenticate("google");
		const cancelled = expect(authentication).rejects.toThrow("cancelled");
		await flush();
		await service.destroy();
		await cancelled;
		expect(service.pendingOAuthState.size).toBe(0);
		expect(jest.getTimerCount()).toBe(0);
	});

	it("times out a stalled launch, rejects a concurrent attempt without stopping its server, and allows retry", async () => {
		const service = createService();
		const authentication = service.authenticate("google");
		const failure = expect(authentication).rejects.toThrow("OAuth timeout");
		await flush();
		await expect(service.authenticate("google")).rejects.toThrow("already in progress");
		expect(service.stopCallbackServer).not.toHaveBeenCalled();
		jest.advanceTimersByTime(300000);
		await failure;
		expect(service.stopCallbackServer).toHaveBeenCalledTimes(1);
		expect(service.pendingOAuthState.size).toBe(0);
		service.openAuthorizationUrl.mockRejectedValue(new Error("browser unavailable"));
		await expect(service.authenticate("google")).rejects.toThrow("browser unavailable");
		expect(service.startCallbackServer).toHaveBeenCalledTimes(2);
		expect(service.stopCallbackServer).toHaveBeenCalledTimes(2);
		expect(jest.getTimerCount()).toBe(0);
	});
});
