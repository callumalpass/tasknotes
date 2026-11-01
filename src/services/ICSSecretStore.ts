import type { SecretStorage } from "obsidian";

type SecretStorageAccess = Pick<SecretStorage, "getSecret" | "setSecret">;

/** Thrown when an ICS subscription password cannot be stored securely. */
export class ICSSecretStorageUnavailableError extends Error {
	constructor() {
		super("Obsidian SecretStorage is not available; the calendar password was not saved");
		this.name = "ICSSecretStorageUnavailableError";
	}
}

/**
 * Stores ICS subscription passwords in Obsidian SecretStorage, never in data.json.
 *
 * SecretStorage has no delete operation, so a cleared password is stored as an
 * empty string and read back as missing.
 */
export class ICSSecretStore {
	constructor(private readonly secretStorage: SecretStorageAccess | undefined) {}

	isAvailable(): boolean {
		return this.secretStorage !== undefined;
	}

	getPassword(subscriptionId: string): string | null {
		if (!this.secretStorage) return null;
		const value = this.secretStorage.getSecret(getICSPasswordSecretId(subscriptionId));
		return value ? value : null;
	}

	setPassword(subscriptionId: string, password: string): void {
		if (!password) {
			this.clearPassword(subscriptionId);
			return;
		}
		this.writeVerified(subscriptionId, password);
	}

	clearPassword(subscriptionId: string): void {
		if (!this.secretStorage) return;
		const secretId = getICSPasswordSecretId(subscriptionId);
		if (this.secretStorage.getSecret(secretId) === null) return;
		this.writeVerified(subscriptionId, "");
	}

	private writeVerified(subscriptionId: string, value: string): void {
		if (!this.secretStorage) {
			throw new ICSSecretStorageUnavailableError();
		}
		const secretId = getICSPasswordSecretId(subscriptionId);
		this.secretStorage.setSecret(secretId, value);
		if (this.secretStorage.getSecret(secretId) !== value) {
			throw new Error(`Obsidian SecretStorage did not persist ${secretId}`);
		}
	}
}

/** SecretStorage IDs must be lowercase alphanumeric with dashes. */
export function getICSPasswordSecretId(subscriptionId: string): string {
	const safeId = subscriptionId.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
	return `tasknotes-ics-${safeId}-password`;
}
