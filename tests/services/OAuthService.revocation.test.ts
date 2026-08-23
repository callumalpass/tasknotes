import { requestUrl } from "obsidian";
import type TaskNotesPlugin from "../../src/main";
import { EVENT_USER_NOTICE } from "../../src/core/userNotices";
import { OAuthSecretStore } from "../../src/services/OAuthSecretStore";
import { OAuthService } from "../../src/services/OAuthService";
import type { OAuthConnection, OAuthProvider } from "../../src/types";

jest.mock("obsidian", () => ({
	Platform: { isDesktopApp: true },
	requestUrl: jest.fn(),
}));

class InMemorySecretStorage {
	private readonly values = new Map<string, string>();

	getSecret(id: string): string | null {
		return this.values.get(id) ?? null;
	}

	setSecret(id: string, value: string): void {
		this.values.set(id, value);
	}
}

function getRequestCall(
	mockRequestUrl: jest.MockedFunction<typeof requestUrl>,
	index: number
): Exclude<Parameters<typeof requestUrl>[0], string> {
	const request = mockRequestUrl.mock.calls[index][0];
	if (typeof request === "string") {
		throw new Error("Expected requestUrl to receive request parameters");
	}
	return request;
}

function createConnection(
	provider: OAuthProvider,
	options: { refreshToken?: string } = { refreshToken: `${provider}-refresh-token` }
): OAuthConnection {
	return {
		provider,
		tokens: {
			accessToken: `${provider}-access-token`,
			refreshToken: options.refreshToken ?? "",
			expiresAt: Date.now() + 3_600_000,
			scope: "calendar.read calendar.write",
			tokenType: "Bearer",
		},
		connectedAt: "2026-01-01T00:00:00.000Z",
	};
}

describe("OAuthService token revocation", () => {
	let sut: OAuthService;
	let secretStore: OAuthSecretStore;
	let mockPlugin: Partial<TaskNotesPlugin>;
	let mockRequestUrl: jest.MockedFunction<typeof requestUrl>;

	beforeEach(() => {
		jest.clearAllMocks();
		secretStore = new OAuthSecretStore(new InMemorySecretStorage());
		secretStore.setCredentials("google", {
			clientId: "google-client-id",
			clientSecret: "google-client-secret",
		});
		secretStore.setConnection("google", createConnection("google"));
		mockPlugin = {
			emitter: { trigger: jest.fn() } as never,
		};
		sut = new OAuthService(mockPlugin as TaskNotesPlugin, secretStore);
		mockRequestUrl = requestUrl as jest.MockedFunction<typeof requestUrl>;
	});

	it("revokes both tokens, clears the connection, and preserves app credentials", async () => {
		mockRequestUrl.mockResolvedValue({
			status: 200,
			json: {},
			text: "OK",
			arrayBuffer: new ArrayBuffer(0),
			headers: {},
		});

		const connectionGeneration = sut.getConnectionGeneration("google");
		await expect(
			sut.isConnectionGenerationCurrent("google", connectionGeneration)
		).resolves.toBe(true);

		await sut.disconnect("google");

		expect(sut.getConnectionGeneration("google")).toBe(connectionGeneration + 1);
		await expect(
			sut.isConnectionGenerationCurrent("google", connectionGeneration)
		).resolves.toBe(false);
		expect(mockRequestUrl).toHaveBeenCalledTimes(2);
		const firstRequest = getRequestCall(mockRequestUrl, 0);
		const secondRequest = getRequestCall(mockRequestUrl, 1);
		expect(firstRequest).toEqual(
			expect.objectContaining({
				url: "https://oauth2.googleapis.com/revoke",
				method: "POST",
				body: expect.stringContaining("token=google-access-token"),
			})
		);
		expect(secondRequest.body).toContain("token=google-refresh-token");
		expect(firstRequest.body).toContain("client_id=google-client-id");
		expect(secretStore.getConnection("google")).toBeNull();
		expect(secretStore.getCredentials("google")).toEqual({
			clientId: "google-client-id",
			clientSecret: "google-client-secret",
		});
		expect(mockPlugin.emitter?.trigger).toHaveBeenCalledWith(
			EVENT_USER_NOTICE,
			expect.objectContaining({ message: "Disconnected from google Calendar" })
		);
	});

	it("keeps the local connection cleared when provider revocation fails", async () => {
		mockRequestUrl.mockRejectedValue(new Error("Network error"));

		await expect(sut.disconnect("google")).resolves.toBeUndefined();

		expect(secretStore.getConnection("google")).toBeNull();
		expect(mockPlugin.emitter?.trigger).toHaveBeenCalledWith(
			EVENT_USER_NOTICE,
			expect.objectContaining({ message: "Disconnected from google Calendar" })
		);
	});

	it("does nothing when the provider is already disconnected", async () => {
		secretStore.clearConnection("google");

		await sut.disconnect("google");

		expect(mockRequestUrl).not.toHaveBeenCalled();
		expect(mockPlugin.emitter?.trigger).not.toHaveBeenCalled();
	});

	it("revokes only the access token when no refresh token is available", async () => {
		secretStore.setConnection("google", createConnection("google", { refreshToken: "" }));
		mockRequestUrl.mockResolvedValue({
			status: 200,
			json: {},
			text: "OK",
			arrayBuffer: new ArrayBuffer(0),
			headers: {},
		});

		await sut.disconnect("google");

		expect(mockRequestUrl).toHaveBeenCalledTimes(1);
		expect(getRequestCall(mockRequestUrl, 0).body).toContain("token=google-access-token");
	});

	it("uses the Microsoft revocation endpoint", async () => {
		secretStore.setCredentials("microsoft", { clientId: "microsoft-client-id" });
		secretStore.setConnection("microsoft", createConnection("microsoft"));
		mockRequestUrl.mockResolvedValue({
			status: 200,
			json: {},
			text: "OK",
			arrayBuffer: new ArrayBuffer(0),
			headers: {},
		});

		await sut.disconnect("microsoft");

		expect(getRequestCall(mockRequestUrl, 0).url).toBe(
			"https://login.microsoftonline.com/common/oauth2/v2.0/logout"
		);
	});
});
