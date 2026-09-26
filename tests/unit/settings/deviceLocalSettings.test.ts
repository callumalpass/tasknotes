import {
	API_AUTH_TOKEN_SECRET_ID,
	loadDeviceLocalSettings,
	persistDeviceLocalSettings,
	stripDeviceLocalSettings,
	type DeviceLocalStorageHost,
} from "../../../src/settings/deviceLocalSettings";

function createHost(options: { rejectSecrets?: boolean } = {}) {
	const secrets = new Map<string, string>();
	const local = new Map<string, unknown>();
	const host: DeviceLocalStorageHost = {
		secretStorage: {
			getSecret: jest.fn((id: string) => secrets.get(id) ?? null),
			setSecret: jest.fn((id: string, value: string) => {
				if (!options.rejectSecrets) secrets.set(id, value);
			}),
		},
		loadLocalStorage: jest.fn((key: string) => local.get(key) ?? null),
		saveLocalStorage: jest.fn((key: string, value: unknown) => {
			if (value === null) local.delete(key);
			else local.set(key, value);
		}),
	};
	return { host, secrets, local };
}

describe("device-local settings (#2345)", () => {
	it("moves values from data.json into device storage on first load", () => {
		const { host, secrets, local } = createHost();

		const settings = loadDeviceLocalSettings(host, {
			apiAuthToken: "legacy-token",
			lastSeenVersion: "4.13.6",
			lastNotifiedReleaseVersion: "4.13.5",
			taskTag: "task",
		});

		expect(settings).toEqual({
			apiAuthToken: "legacy-token",
			lastSeenVersion: "4.13.6",
			lastNotifiedReleaseVersion: "4.13.5",
		});
		expect(secrets.get(API_AUTH_TOKEN_SECRET_ID)).toBe("legacy-token");
		expect(local.get("tasknotes-last-seen-version")).toBe("4.13.6");
		expect(local.get("tasknotes-last-notified-release-version")).toBe("4.13.5");
	});

	it("prefers this device's values over values synced in data.json", () => {
		const { host, secrets, local } = createHost();
		secrets.set(API_AUTH_TOKEN_SECRET_ID, "device-token");
		local.set("tasknotes-last-seen-version", "5.0.0");

		const settings = loadDeviceLocalSettings(host, {
			apiAuthToken: "other-device-token",
			lastSeenVersion: "4.13.6",
		});

		expect(settings.apiAuthToken).toBe("device-token");
		expect(settings.lastSeenVersion).toBe("5.0.0");
		expect(secrets.get(API_AUTH_TOKEN_SECRET_ID)).toBe("device-token");
	});

	it("starts empty on a device without stored or legacy values", () => {
		const { host } = createHost();

		expect(loadDeviceLocalSettings(host, { taskTag: "task" })).toEqual({
			apiAuthToken: "",
			lastSeenVersion: undefined,
			lastNotifiedReleaseVersion: undefined,
		});
	});

	it("does not report a migrated token when secret storage rejects it", () => {
		const { host } = createHost({ rejectSecrets: true });

		expect(() => loadDeviceLocalSettings(host, { apiAuthToken: "legacy-token" })).toThrow(
			"Could not verify"
		);
	});

	it("stores saved values on the device and removes them from data.json", () => {
		const { host, secrets, local } = createHost();

		const written = persistDeviceLocalSettings(host, {
			apiAuthToken: "new-token",
			lastSeenVersion: "5.0.0",
			lastNotifiedReleaseVersion: undefined,
			taskTag: "task",
		});

		expect(written).toEqual({ taskTag: "task" });
		expect(secrets.get(API_AUTH_TOKEN_SECRET_ID)).toBe("new-token");
		expect(local.get("tasknotes-last-seen-version")).toBe("5.0.0");
		expect(local.has("tasknotes-last-notified-release-version")).toBe(false);
		expect(loadDeviceLocalSettings(host, written)).toEqual({
			apiAuthToken: "new-token",
			lastSeenVersion: "5.0.0",
			lastNotifiedReleaseVersion: undefined,
		});
	});

	it("leaves device values alone for data.json writes that do not include them", () => {
		const { host, secrets } = createHost();
		secrets.set(API_AUTH_TOKEN_SECRET_ID, "device-token");
		const data = { pomodoroState: { isRunning: false } };

		expect(persistDeviceLocalSettings(host, data)).toBe(data);
		expect(host.secretStorage.setSecret).not.toHaveBeenCalled();
		expect(host.saveLocalStorage).not.toHaveBeenCalled();
	});

	it("clears the token when the setting is emptied", () => {
		const { host, secrets } = createHost();
		secrets.set(API_AUTH_TOKEN_SECRET_ID, "device-token");

		persistDeviceLocalSettings(host, { apiAuthToken: "" });

		expect(loadDeviceLocalSettings(host, {}).apiAuthToken).toBe("");
	});

	it("returns the same object when there is nothing to strip", () => {
		const data = { taskTag: "task" };
		expect(stripDeviceLocalSettings(data)).toBe(data);
	});
});
