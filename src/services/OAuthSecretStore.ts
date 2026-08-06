import type { SecretStorage } from "obsidian";
import type { OAuthConnection, OAuthProvider } from "../types";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/OAuthSecretStore" });

export type OAuthCredentials = {
	clientId: string;
	clientSecret?: string;
};

type CredentialsEnvelope =
	| {
			version: 1;
			state: "configured";
			credentials: OAuthCredentials;
	  }
	| {
			version: 1;
			state: "cleared";
	  };

type ConnectionEnvelope =
	| {
			version: 1;
			state: "connected";
			connection: OAuthConnection;
	  }
	| {
			version: 1;
			state: "cleared";
	  };

export type OAuthCredentialsState =
	| { status: "missing" }
	| { status: "configured"; credentials: OAuthCredentials }
	| { status: "cleared" }
	| { status: "invalid" };

export type OAuthConnectionState =
	| { status: "missing" }
	| { status: "connected"; connection: OAuthConnection }
	| { status: "cleared" }
	| { status: "invalid" };

type SecretStorageAccess = Pick<SecretStorage, "getSecret" | "setSecret">;

type ProviderSecretIds = {
	credentials: string;
	connection: string;
};

const OAUTH_SECRET_IDS: Record<OAuthProvider, ProviderSecretIds> = {
	google: {
		credentials: "tasknotes-oauth-google-credentials",
		connection: "tasknotes-oauth-google-connection",
	},
	microsoft: {
		credentials: "tasknotes-oauth-microsoft-credentials",
		connection: "tasknotes-oauth-microsoft-connection",
	},
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

export function parseOAuthConnection(
	value: unknown,
	provider: OAuthProvider
): OAuthConnection | null {
	if (!isRecord(value) || value.provider !== provider || !isRecord(value.tokens)) {
		return null;
	}

	const accessToken = value.tokens.accessToken;
	const expiresAt = value.tokens.expiresAt;
	if (
		typeof accessToken !== "string" ||
		accessToken.length === 0 ||
		typeof expiresAt !== "number" ||
		!Number.isFinite(expiresAt)
	) {
		return null;
	}

	const connectedAt = optionalString(value.connectedAt) ?? "";
	return {
		provider,
		tokens: {
			accessToken,
			refreshToken: optionalString(value.tokens.refreshToken) ?? "",
			expiresAt,
			scope: optionalString(value.tokens.scope) ?? "",
			tokenType: optionalString(value.tokens.tokenType) ?? "Bearer",
		},
		...(optionalString(value.userEmail) !== undefined && {
			userEmail: optionalString(value.userEmail),
		}),
		connectedAt,
		...(optionalString(value.lastRefreshed) !== undefined && {
			lastRefreshed: optionalString(value.lastRefreshed),
		}),
	};
}

function parseCredentialsEnvelope(raw: string): OAuthCredentialsState {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!isRecord(parsed) || parsed.version !== 1) {
			return { status: "invalid" };
		}
		if (parsed.state === "cleared") {
			return { status: "cleared" };
		}
		if (parsed.state !== "configured" || !isRecord(parsed.credentials)) {
			return { status: "invalid" };
		}

		const clientId = parsed.credentials.clientId;
		const clientSecret = parsed.credentials.clientSecret;
		if (
			typeof clientId !== "string" ||
			(clientSecret !== undefined && typeof clientSecret !== "string")
		) {
			return { status: "invalid" };
		}

		return {
			status: "configured",
			credentials: {
				clientId,
				...(typeof clientSecret === "string" && clientSecret.length > 0
					? { clientSecret }
					: {}),
			},
		};
	} catch {
		return { status: "invalid" };
	}
}

function parseConnectionEnvelope(raw: string, provider: OAuthProvider): OAuthConnectionState {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!isRecord(parsed) || parsed.version !== 1) {
			return { status: "invalid" };
		}
		if (parsed.state === "cleared") {
			return { status: "cleared" };
		}
		if (parsed.state !== "connected") {
			return { status: "invalid" };
		}

		const connection = parseOAuthConnection(parsed.connection, provider);
		return connection ? { status: "connected", connection } : { status: "invalid" };
	} catch {
		return { status: "invalid" };
	}
}

export class OAuthSecretStore {
	constructor(private readonly secretStorage: SecretStorageAccess) {}

	getCredentialsState(provider: OAuthProvider): OAuthCredentialsState {
		const secretId = OAUTH_SECRET_IDS[provider].credentials;
		const raw = this.secretStorage.getSecret(secretId);
		if (raw === null) {
			return { status: "missing" };
		}

		const state = parseCredentialsEnvelope(raw);
		if (state.status === "invalid") {
			tasknotesLogger.warn("Stored OAuth credentials could not be read", {
				category: "configuration",
				operation: "read-oauth-credentials",
				details: { provider },
			});
		}
		return state;
	}

	getCredentials(provider: OAuthProvider): OAuthCredentials | null {
		const state = this.getCredentialsState(provider);
		return state.status === "configured" ? state.credentials : null;
	}

	setCredentials(provider: OAuthProvider, credentials: OAuthCredentials): void {
		const envelope: CredentialsEnvelope = {
			version: 1,
			state: "configured",
			credentials: {
				clientId: credentials.clientId.trim(),
				...(credentials.clientSecret?.trim()
					? { clientSecret: credentials.clientSecret.trim() }
					: {}),
			},
		};
		this.writeVerified(OAUTH_SECRET_IDS[provider].credentials, envelope);
	}

	clearCredentials(provider: OAuthProvider): void {
		const envelope: CredentialsEnvelope = { version: 1, state: "cleared" };
		this.writeVerified(OAUTH_SECRET_IDS[provider].credentials, envelope);
	}

	getConnectionState(provider: OAuthProvider): OAuthConnectionState {
		const secretId = OAUTH_SECRET_IDS[provider].connection;
		const raw = this.secretStorage.getSecret(secretId);
		if (raw === null) {
			return { status: "missing" };
		}

		const state = parseConnectionEnvelope(raw, provider);
		if (state.status === "invalid") {
			tasknotesLogger.warn("Stored OAuth connection could not be read", {
				category: "configuration",
				operation: "read-oauth-connection",
				details: { provider },
			});
		}
		return state;
	}

	getConnection(provider: OAuthProvider): OAuthConnection | null {
		const state = this.getConnectionState(provider);
		return state.status === "connected" ? state.connection : null;
	}

	setConnection(provider: OAuthProvider, connection: OAuthConnection): void {
		const normalized = parseOAuthConnection(connection, provider);
		if (!normalized) {
			throw new Error(`Cannot store an invalid ${provider} OAuth connection`);
		}

		const envelope: ConnectionEnvelope = {
			version: 1,
			state: "connected",
			connection: normalized,
		};
		this.writeVerified(OAUTH_SECRET_IDS[provider].connection, envelope);
	}

	clearConnection(provider: OAuthProvider): void {
		const envelope: ConnectionEnvelope = { version: 1, state: "cleared" };
		this.writeVerified(OAUTH_SECRET_IDS[provider].connection, envelope);
	}

	private writeVerified(secretId: string, value: CredentialsEnvelope | ConnectionEnvelope): void {
		const serialized = JSON.stringify(value);
		this.secretStorage.setSecret(secretId, serialized);
		if (this.secretStorage.getSecret(secretId) !== serialized) {
			throw new Error(`Obsidian SecretStorage did not persist ${secretId}`);
		}
	}
}
