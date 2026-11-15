import { Platform, requestUrl, type App } from "obsidian";
import {
	CalendarServiceClient,
	type CalendarServiceHost,
	type CredentialStore,
	type KeyValueStore,
	type ServiceTransport,
} from "@tasknotes/calendar-service-client";
import { CALENDAR_SERVICE_CONSTANTS } from "./constants";

type SecretStorageAccess = Pick<App["secretStorage"], "getSecret" | "setSecret">;
type LocalStorageAccess = Pick<App, "loadLocalStorage" | "saveLocalStorage">;

/** Keeps this device's session credential in Obsidian SecretStorage. */
export function sessionCredentialStore(secrets: SecretStorageAccess): CredentialStore {
	const id = CALENDAR_SERVICE_CONSTANTS.SESSION_SECRET_ID;
	return {
		load: () => Promise.resolve(secrets.getSecret(id) || null),
		save: (credential) => {
			secrets.setSecret(id, credential);
			return Promise.resolve();
		},
		// SecretStorage has no removal; an empty value reads back as none.
		clear: () => {
			if (secrets.getSecret(id)) secrets.setSecret(id, "");
			return Promise.resolve();
		},
	};
}

/** The vault's own local storage on this device: never synced, never a credential. */
export function vaultLocalStore(app: LocalStorageAccess): KeyValueStore {
	const key = (name: string) => `${CALENDAR_SERVICE_CONSTANTS.STORAGE_PREFIX}${name}`;
	return {
		getItem: (name) => {
			const value: unknown = app.loadLocalStorage(key(name));
			return typeof value === "string" ? value : null;
		},
		setItem: (name, value) => app.saveLocalStorage(key(name), value),
		removeItem: (name) => app.saveLocalStorage(key(name), null),
	};
}

/**
 * Sends the client's requests through Obsidian, which is not held to the
 * service's CORS list on mobile. Failing to reach the service rejects with a
 * `TypeError`, as `fetch` does, so the client treats it as a passing outage.
 */
export const obsidianTransport: ServiceTransport = async (url, request) => {
	request.signal.throwIfAborted();
	const aborted = new Promise<never>((_, reject) => {
		request.signal.addEventListener("abort", () => reject(request.signal.reason as Error), {
			once: true,
		});
	});
	// Losing the race must not leave a rejection nobody is listening for.
	aborted.catch(() => undefined);
	const sent = requestUrl({
		url,
		method: request.method,
		headers: request.headers,
		body: request.body,
		throw: false,
	}).then(
		(response) => response,
		(reason: unknown) => {
			throw new TypeError(reason instanceof Error ? reason.message : String(reason));
		}
	);
	const response = await Promise.race([sent, aborted]);
	return {
		status: response.status,
		ok: response.status >= 200 && response.status < 300,
		json: () => Promise.resolve(JSON.parse(response.text) as unknown),
	};
};

export function obsidianCalendarHost(app: Pick<App, "secretStorage">): CalendarServiceHost {
	return {
		clientKind: "obsidian",
		deviceName: Platform.isMobile ? "TaskNotes for Obsidian (mobile)" : "TaskNotes for Obsidian",
		credentials: sessionCredentialStore(app.secretStorage),
		// Obsidian hands the address to the system browser; there is no window to close.
		openWindow: () => ({
			show: (url) => void window.open(url, "_blank"),
			close: () => undefined,
		}),
	};
}

export function createCalendarServiceClient(app: App): CalendarServiceClient {
	return new CalendarServiceClient({
		origin: CALENDAR_SERVICE_CONSTANTS.ORIGIN,
		host: obsidianCalendarHost(app),
		storage: vaultLocalStore(app),
		transport: obsidianTransport,
	});
}
