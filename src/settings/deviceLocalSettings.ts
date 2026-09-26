import type { App } from "obsidian";
import type { TaskNotesSettings } from "../types/settings";

/**
 * Settings that belong to one device rather than to the shareable data.json:
 * the local HTTP API credential and release bookkeeping (#2345).
 */
export type DeviceLocalSettings = Pick<
	TaskNotesSettings,
	"apiAuthToken" | "lastSeenVersion" | "lastNotifiedReleaseVersion"
>;

type DeviceLocalKey = keyof DeviceLocalSettings;

export type DeviceLocalStorageHost = {
	secretStorage: Pick<App["secretStorage"], "getSecret" | "setSecret">;
	loadLocalStorage: App["loadLocalStorage"];
	saveLocalStorage: App["saveLocalStorage"];
};

export const API_AUTH_TOKEN_SECRET_ID = "tasknotes-api-auth-token";

const LOCAL_STORAGE_KEYS = {
	lastSeenVersion: "tasknotes-last-seen-version",
	lastNotifiedReleaseVersion: "tasknotes-last-notified-release-version",
} as const;

export const DEVICE_LOCAL_SETTING_KEYS: readonly DeviceLocalKey[] = [
	"apiAuthToken",
	"lastSeenVersion",
	"lastNotifiedReleaseVersion",
];

function hasOwn(data: Record<string, unknown>, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(data, key);
}

function nonEmptyString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readApiAuthToken(host: DeviceLocalStorageHost): string {
	return host.secretStorage.getSecret(API_AUTH_TOKEN_SECRET_ID) ?? "";
}

function writeApiAuthToken(host: DeviceLocalStorageHost, token: string): void {
	if (readApiAuthToken(host) === token) return;
	host.secretStorage.setSecret(API_AUTH_TOKEN_SECRET_ID, token);
	if (readApiAuthToken(host) !== token) {
		throw new Error("Could not verify the TaskNotes API token in secret storage");
	}
}

function writeLocalValue(
	host: DeviceLocalStorageHost,
	key: keyof typeof LOCAL_STORAGE_KEYS,
	value: string | undefined
): void {
	const storageKey = LOCAL_STORAGE_KEYS[key];
	if (nonEmptyString(host.loadLocalStorage(storageKey)) === value) return;
	host.saveLocalStorage(storageKey, value ?? null);
}

/**
 * Reads this device's values. Values still in data.json from earlier versions fill
 * missing device values and are copied to device storage before the caller strips them.
 */
export function loadDeviceLocalSettings(
	host: DeviceLocalStorageHost,
	legacyData: Record<string, unknown> | null | undefined
): DeviceLocalSettings {
	const legacy = legacyData ?? {};

	let apiAuthToken = readApiAuthToken(host);
	const legacyToken = nonEmptyString(legacy.apiAuthToken);
	if (!apiAuthToken && legacyToken) {
		writeApiAuthToken(host, legacyToken);
		apiAuthToken = legacyToken;
	}

	const readVersion = (key: keyof typeof LOCAL_STORAGE_KEYS): string | undefined => {
		const stored = nonEmptyString(host.loadLocalStorage(LOCAL_STORAGE_KEYS[key]));
		if (stored) return stored;
		const legacyValue = nonEmptyString(legacy[key]);
		if (legacyValue) writeLocalValue(host, key, legacyValue);
		return legacyValue;
	};

	return {
		apiAuthToken,
		lastSeenVersion: readVersion("lastSeenVersion"),
		lastNotifiedReleaseVersion: readVersion("lastNotifiedReleaseVersion"),
	};
}

/** Removes device-local keys so they are never written to data.json. */
export function stripDeviceLocalSettings(data: Record<string, unknown>): Record<string, unknown> {
	if (!DEVICE_LOCAL_SETTING_KEYS.some((key) => hasOwn(data, key))) return data;
	const sanitized = { ...data };
	for (const key of DEVICE_LOCAL_SETTING_KEYS) delete sanitized[key];
	return sanitized;
}

/**
 * Stores the device-local values present in a data.json write on this device and
 * returns the data without them.
 */
export function persistDeviceLocalSettings(
	host: DeviceLocalStorageHost,
	data: Record<string, unknown>
): Record<string, unknown> {
	if (hasOwn(data, "apiAuthToken")) {
		writeApiAuthToken(host, typeof data.apiAuthToken === "string" ? data.apiAuthToken : "");
	}
	for (const key of Object.keys(LOCAL_STORAGE_KEYS) as (keyof typeof LOCAL_STORAGE_KEYS)[]) {
		if (hasOwn(data, key)) writeLocalValue(host, key, nonEmptyString(data[key]));
	}
	return stripDeviceLocalSettings(data);
}
