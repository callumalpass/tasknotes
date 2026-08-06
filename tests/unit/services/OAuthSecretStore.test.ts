import { describe, expect, it } from "@jest/globals";
import { OAuthSecretStore, type OAuthCredentials } from "../../../src/services/OAuthSecretStore";
import {
	migrateLegacyOAuthData,
	stripLegacyOAuthData,
} from "../../../src/services/oauthSecretMigration";
import type { OAuthConnection, OAuthProvider } from "../../../src/types";

class InMemorySecretStorage {
	private readonly values = new Map<string, string>();

	getSecret(id: string): string | null {
		return this.values.get(id) ?? null;
	}

	setSecret(id: string, value: string): void {
		this.values.set(id, value);
	}
}

type SecretStorageStub = {
	getSecret(id: string): string | null;
	setSecret(id: string, value: string): void;
};

function createStore(storage: SecretStorageStub = new InMemorySecretStorage()): OAuthSecretStore {
	return new OAuthSecretStore(storage);
}

function createCredentials(clientId: string): OAuthCredentials {
	return { clientId, clientSecret: `${clientId}-secret` };
}

function createConnection(provider: OAuthProvider, accessToken: string): OAuthConnection {
	return {
		provider,
		tokens: {
			accessToken,
			refreshToken: `${accessToken}-refresh`,
			expiresAt: 2_000_000_000_000,
			scope: "calendar.read calendar.write",
			tokenType: "Bearer",
		},
		userEmail: `${provider}@example.com`,
		connectedAt: "2026-01-01T00:00:00.000Z",
		lastRefreshed: "2026-01-02T00:00:00.000Z",
	};
}

describe("OAuth secret migration", () => {
	it("moves OAuth credentials and account tokens out of plugin data", () => {
		const sut = createStore();
		const legacyGoogleConnection = createConnection("google", "google-access");
		const legacyMicrosoftConnection = createConnection("microsoft", "microsoft-access");
		const legacyData = {
			tasksFolder: "Projects/Tasks",
			googleOAuthClientId: "google-client",
			googleOAuthClientSecret: "google-secret",
			microsoftOAuthClientId: "microsoft-client",
			microsoftOAuthClientSecret: "microsoft-secret",
			oauthConnections: {
				google: legacyGoogleConnection,
				microsoft: legacyMicrosoftConnection,
			},
		};

		const result = migrateLegacyOAuthData(legacyData, sut);

		expect(result).toEqual({
			changed: true,
			data: { tasksFolder: "Projects/Tasks" },
		});
		expect(sut.getCredentials("google")).toEqual({
			clientId: "google-client",
			clientSecret: "google-secret",
		});
		expect(sut.getCredentials("microsoft")).toEqual({
			clientId: "microsoft-client",
			clientSecret: "microsoft-secret",
		});
		expect(sut.getConnection("google")).toEqual(legacyGoogleConnection);
		expect(sut.getConnection("microsoft")).toEqual(legacyMicrosoftConnection);
	});

	it("keeps newer secure values when stale plugin data reappears", () => {
		const sut = createStore();
		sut.setCredentials("google", createCredentials("current-client"));
		sut.setConnection("google", createConnection("google", "current-access"));

		const result = migrateLegacyOAuthData(
			{
				googleOAuthClientId: "stale-client",
				googleOAuthClientSecret: "stale-secret",
				oauthConnections: {
					google: createConnection("google", "stale-access"),
				},
			},
			sut
		);

		expect(result.data).toEqual({});
		expect(sut.getCredentials("google")).toEqual(createCredentials("current-client"));
		expect(sut.getConnection("google")?.tokens.accessToken).toBe("current-access");
	});

	it("does not resurrect credentials or connections after they were cleared", () => {
		const sut = createStore();
		sut.clearCredentials("google");
		sut.clearConnection("google");

		migrateLegacyOAuthData(
			{
				googleOAuthClientId: "restored-client",
				googleOAuthClientSecret: "restored-secret",
				oauthConnections: {
					google: createConnection("google", "restored-access"),
				},
			},
			sut
		);

		expect(sut.getCredentials("google")).toBeNull();
		expect(sut.getConnection("google")).toBeNull();
	});

	it("leaves the source data untouched when SecretStorage cannot verify a write", () => {
		const storage = {
			getSecret: () => null,
			setSecret: () => undefined,
		};
		const sut = createStore(storage);
		const legacyData = {
			googleOAuthClientId: "google-client",
			googleOAuthClientSecret: "google-secret",
		};

		expect(() => migrateLegacyOAuthData(legacyData, sut)).toThrow(
			"SecretStorage did not persist"
		);
		expect(legacyData).toEqual({
			googleOAuthClientId: "google-client",
			googleOAuthClientSecret: "google-secret",
		});
	});

	it("redacts stale OAuth values while preserving unrelated plugin data", () => {
		const staleSnapshot = {
			tasksFolder: "Projects/Tasks",
			googleOAuthClientId: "client-id",
			googleOAuthClientSecret: "client-secret",
			oauthConnections: {
				google: createConnection("google", "access-token"),
				legacyProvider: { keep: true },
			},
		};

		expect(stripLegacyOAuthData(staleSnapshot)).toEqual({
			tasksFolder: "Projects/Tasks",
			oauthConnections: {
				legacyProvider: { keep: true },
			},
		});
	});
});
