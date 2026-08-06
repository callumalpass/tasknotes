import type { OAuthProvider } from "../types";
import { OAuthSecretStore, parseOAuthConnection, type OAuthCredentials } from "./OAuthSecretStore";

const PROVIDERS: OAuthProvider[] = ["google", "microsoft"];

const LEGACY_CREDENTIAL_KEYS: Record<OAuthProvider, { clientId: string; clientSecret: string }> = {
	google: {
		clientId: "googleOAuthClientId",
		clientSecret: "googleOAuthClientSecret",
	},
	microsoft: {
		clientId: "microsoftOAuthClientId",
		clientSecret: "microsoftOAuthClientSecret",
	},
};

export type OAuthSecretMigrationResult = {
	data: Record<string, unknown> | null;
	changed: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(data: Record<string, unknown>, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(data, key);
}

function readLegacyCredentials(
	data: Record<string, unknown>,
	provider: OAuthProvider
): OAuthCredentials | null {
	const keys = LEGACY_CREDENTIAL_KEYS[provider];
	const clientId = data[keys.clientId];
	const clientSecret = data[keys.clientSecret];
	if (typeof clientId !== "string" && typeof clientSecret !== "string") {
		return null;
	}

	const credentials: OAuthCredentials = {
		clientId: typeof clientId === "string" ? clientId : "",
	};
	if (typeof clientSecret === "string" && clientSecret.length > 0) {
		credentials.clientSecret = clientSecret;
	}
	return credentials;
}

/**
 * Removes OAuth values that were historically persisted in data.json.
 * Callers must migrate those values to SecretStorage before invoking this helper.
 */
export function stripLegacyOAuthData(data: Record<string, unknown>): Record<string, unknown> {
	let changed = false;
	const sanitized = { ...data };

	for (const provider of PROVIDERS) {
		const keys = LEGACY_CREDENTIAL_KEYS[provider];
		for (const key of [keys.clientId, keys.clientSecret]) {
			if (hasOwn(sanitized, key)) {
				delete sanitized[key];
				changed = true;
			}
		}
	}

	if (hasOwn(sanitized, "oauthConnections")) {
		const connections = sanitized.oauthConnections;
		if (isRecord(connections)) {
			const remainingConnections = { ...connections };
			for (const provider of PROVIDERS) {
				if (hasOwn(remainingConnections, provider)) {
					delete remainingConnections[provider];
					changed = true;
				}
			}

			if (Object.keys(remainingConnections).length === 0) {
				delete sanitized.oauthConnections;
				changed = true;
			} else if (changed) {
				sanitized.oauthConnections = remainingConnections;
			}
		} else {
			delete sanitized.oauthConnections;
			changed = true;
		}
	}

	return changed ? sanitized : data;
}

/**
 * Copies legacy OAuth credentials and connections into Obsidian SecretStorage.
 * Secure values are written and verified before the returned data is sanitized,
 * making retries safe if the eventual data.json write is interrupted.
 */
export function migrateLegacyOAuthData(
	data: Record<string, unknown> | null,
	secretStore: OAuthSecretStore
): OAuthSecretMigrationResult {
	if (data === null) {
		return { data, changed: false };
	}

	for (const provider of PROVIDERS) {
		const keys = LEGACY_CREDENTIAL_KEYS[provider];
		const hasLegacyCredentials = hasOwn(data, keys.clientId) || hasOwn(data, keys.clientSecret);
		if (hasLegacyCredentials) {
			const legacyCredentials = readLegacyCredentials(data, provider);
			const currentState = secretStore.getCredentialsState(provider);
			if (
				legacyCredentials &&
				(currentState.status === "missing" || currentState.status === "invalid")
			) {
				secretStore.setCredentials(provider, legacyCredentials);
			}
		}
	}

	if (hasOwn(data, "oauthConnections")) {
		const connections = data.oauthConnections;
		if (connections !== null && !isRecord(connections)) {
			throw new Error("Cannot migrate malformed OAuth connection storage");
		}

		if (isRecord(connections)) {
			for (const provider of PROVIDERS) {
				if (!hasOwn(connections, provider) || connections[provider] === null) {
					continue;
				}

				const currentState = secretStore.getConnectionState(provider);
				if (currentState.status === "connected" || currentState.status === "cleared") {
					continue;
				}

				const connection = parseOAuthConnection(connections[provider], provider);
				if (!connection) {
					throw new Error(`Cannot migrate malformed ${provider} OAuth connection`);
				}
				secretStore.setConnection(provider, connection);
			}
		}
	}

	const sanitized = stripLegacyOAuthData(data);
	return {
		data: sanitized,
		changed: sanitized !== data,
	};
}
