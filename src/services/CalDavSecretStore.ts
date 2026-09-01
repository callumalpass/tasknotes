/**
 * CalDAV credentials, held in Obsidian's SecretStorage.
 *
 * Follows the same shape as OAuthSecretStore: a versioned envelope with an
 * explicit "cleared" tombstone (distinct from "missing"), reads that return a
 * status union rather than throwing, and writes that are read back to confirm
 * they actually persisted.
 *
 * Credentials never touch `data.json` — only the non-secret account
 * configuration does.
 */

import type { SecretStorage } from "obsidian";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/CalDavSecretStore" });

export interface CalDavAccountCredentials {
	username: string;
	/** Password, or an app-specific password for iCloud and similar. */
	password: string;
}

type CredentialsEnvelope =
	| { version: 1; state: "configured"; credentials: CalDavAccountCredentials }
	| { version: 1; state: "cleared" };

export type CalDavCredentialsState =
	| { status: "missing" }
	| { status: "configured"; credentials: CalDavAccountCredentials }
	| { status: "cleared" }
	| { status: "invalid" };

type SecretStorageAccess = Pick<SecretStorage, "getSecret" | "setSecret">;

const SECRET_ID_PREFIX = "tasknotes-caldav-";
const SECRET_ID_SUFFIX = "-credentials";
/** Obsidian rejects anything longer than this outright. */
const SECRET_ID_MAX_LENGTH = 64;
const ACCOUNT_SLUG_MAX_LENGTH =
	SECRET_ID_MAX_LENGTH - SECRET_ID_PREFIX.length - SECRET_ID_SUFFIX.length;

/**
 * Obsidian only accepts lowercase alphanumerics and dashes, up to 64
 * characters, and throws on anything else. Account ids are generated with a
 * separator and can be edited by hand, so they are folded into that alphabet
 * here rather than trusted.
 */
function slugifyAccountId(accountId: string): string {
	const slug = accountId
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-+|-+$/gu, "");
	if (!slug) return "account";
	if (slug.length <= ACCOUNT_SLUG_MAX_LENGTH) return slug;

	// Truncation alone would let two long ids sharing a prefix collide into one
	// another's secret, so the discriminator is derived from the whole id.
	const digest = fnv1aHex(accountId);
	const head = slug.slice(0, ACCOUNT_SLUG_MAX_LENGTH - digest.length - 1).replace(/-+$/u, "");
	return `${head}-${digest}`;
}

/** FNV-1a, purely as a short collision discriminator — not a security hash. */
function fnv1aHex(value: string): string {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, "0");
}

/**
 * Secret ids are namespaced per account. The id is restricted to characters
 * that are safe in a key, so an account id can never collide with or escape
 * into another account's slot.
 */
export function calDavSecretId(accountId: string): string {
	return `${SECRET_ID_PREFIX}${slugifyAccountId(accountId)}${SECRET_ID_SUFFIX}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCredentialsEnvelope(raw: string): CalDavCredentialsState {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!isRecord(parsed) || parsed.version !== 1) return { status: "invalid" };
		if (parsed.state === "cleared") return { status: "cleared" };
		if (parsed.state !== "configured" || !isRecord(parsed.credentials)) {
			return { status: "invalid" };
		}

		const { username, password } = parsed.credentials;
		if (typeof username !== "string" || typeof password !== "string" || !username) {
			return { status: "invalid" };
		}

		return { status: "configured", credentials: { username, password } };
	} catch {
		return { status: "invalid" };
	}
}

export class CalDavSecretStore {
	constructor(private readonly secretStorage: SecretStorageAccess) {}

	getCredentialsState(accountId: string): CalDavCredentialsState {
		const secretId = calDavSecretId(accountId);
		const raw = this.secretStorage.getSecret(secretId);
		if (raw === null || raw === undefined) return { status: "missing" };

		const state = parseCredentialsEnvelope(raw);
		if (state.status === "invalid") {
			// Deliberately logs the account id only — never the stored payload.
			tasknotesLogger.warn("Stored CalDAV credentials could not be read", {
				category: "configuration",
				operation: "read-caldav-credentials",
				details: { accountId },
			});
		}
		return state;
	}

	getCredentials(accountId: string): CalDavAccountCredentials | null {
		const state = this.getCredentialsState(accountId);
		return state.status === "configured" ? state.credentials : null;
	}

	setCredentials(accountId: string, credentials: CalDavAccountCredentials): void {
		const username = credentials.username.trim();
		if (!username) {
			throw new Error("CalDAV credentials require a username");
		}

		this.writeVerified(calDavSecretId(accountId), {
			version: 1,
			state: "configured",
			// The password is stored verbatim: leading or trailing whitespace can
			// be significant, and app-specific passwords are generated, not typed.
			credentials: { username, password: credentials.password },
		});
	}

	clearCredentials(accountId: string): void {
		this.writeVerified(calDavSecretId(accountId), { version: 1, state: "cleared" });
	}

	hasCredentials(accountId: string): boolean {
		return this.getCredentialsState(accountId).status === "configured";
	}

	private writeVerified(secretId: string, value: CredentialsEnvelope): void {
		const serialized = JSON.stringify(value);
		this.secretStorage.setSecret(secretId, serialized);
		if (this.secretStorage.getSecret(secretId) !== serialized) {
			throw new Error(`Obsidian SecretStorage did not persist ${secretId}`);
		}
	}
}
