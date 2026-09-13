import { OAuthService } from "../../src/services/OAuthService";
import { OAuthSecretStore } from "../../src/services/OAuthSecretStore";

describe("OAuth callback validation", () => {
	it("validates and consumes OAuth state before writing a static response", () => {
		const store = new OAuthSecretStore({ getSecret: () => null, setSecret: () => {} });
		const service: any = new OAuthService({} as any, store);
		const response: any = { writeHead: jest.fn(), end: jest.fn() };
		service.handleCallback(
			{ method: "GET", url: "/?error=%3Cscript%3E&state=unknown", headers: {} },
			response
		);
		expect(response.writeHead.mock.calls[0][0]).toBe(400);
		expect(response.end.mock.calls[0][0]).not.toContain("<script>");
		const resolve = jest.fn();
		service.pendingOAuthState.set("known", { resolve, reject: jest.fn() });
		response.writeHead = jest.fn(() =>
			expect(service.pendingOAuthState.has("known")).toBe(false)
		);
		service.handleCallback(
			{ method: "GET", url: "/?code=fixture-code&state=known", headers: {} },
			response
		);
		expect(resolve).toHaveBeenCalledWith("fixture-code");
		expect(response.writeHead.mock.calls[0][1]["Content-Security-Policy"]).toContain(
			"frame-ancestors 'none'"
		);
		expect(response.writeHead.mock.calls[0][1]["Cache-Control"]).toBe("no-store");
		service.handleCallback(
			{ method: "GET", url: "/?code=replay&state=known", headers: {} },
			response
		);
		expect(resolve).toHaveBeenCalledTimes(1);
	});
});
