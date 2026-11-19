import { describe, expect, it, jest, afterEach } from "@jest/globals";
import { Plugin } from "obsidian";
import TaskNotesPlugin from "../../../src/main";
import { API_AUTH_TOKEN_SECRET_ID } from "../../../src/settings/deviceLocalSettings";
import { OAuthSecretStore } from "../../../src/services/OAuthSecretStore";

function createPlugin(stored: Record<string, unknown>) {
	const secrets = new Map<string, string>();
	const local = new Map<string, unknown>();
	let disk: Record<string, unknown> | null = { ...stored };
	const app = {
		vault: {
			configDir: ".obsidian",
			adapter: { exists: jest.fn(async () => disk !== null) },
		},
		secretStorage: {
			getSecret: jest.fn((id: string) => secrets.get(id) ?? null),
			setSecret: jest.fn((id: string, value: string) => void secrets.set(id, value)),
		},
		loadLocalStorage: jest.fn((key: string) => local.get(key) ?? null),
		saveLocalStorage: jest.fn((key: string, value: unknown) => {
			if (value === null) local.delete(key);
			else local.set(key, value);
		}),
	} as any;

	const plugin = new TaskNotesPlugin(app);
	(plugin as any).manifest = {
		id: "tasknotes",
		dir: ".obsidian/plugins/tasknotes",
		version: "5.0.0",
	};
	(plugin as any).oauthSecretStore = new OAuthSecretStore(app.secretStorage);
	(plugin as any).settingsLifecycleService = {
		saveSettings: jest.fn(() => plugin.saveSettingsDataOnly()),
	};
	jest.spyOn(Plugin.prototype, "loadData").mockImplementation(async () =>
		disk ? JSON.parse(JSON.stringify(disk)) : null
	);
	const saveData = jest.spyOn(Plugin.prototype, "saveData").mockImplementation(async (data: unknown) => {
		disk = JSON.parse(JSON.stringify(data));
	});

	return { plugin, secrets, local, readDisk: () => disk, saveData };
}

describe("issue #2345 device-local values stay out of data.json", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("moves the API token and release bookkeeping out of data.json on load", async () => {
		const { plugin, secrets, local, readDisk } = createPlugin({
			apiAuthToken: "legacy-token",
			lastSeenVersion: "4.13.6",
			lastNotifiedReleaseVersion: "4.13.5",
			taskTag: "task",
		});

		await plugin.loadSettings();

		expect(plugin.settings.apiAuthToken).toBe("legacy-token");
		expect(plugin.settings.lastSeenVersion).toBe("4.13.6");
		expect(secrets.get(API_AUTH_TOKEN_SECRET_ID)).toBe("legacy-token");
		expect(local.get("tasknotes-last-seen-version")).toBe("4.13.6");
		// 4.x devices sharing this data.json would otherwise see a new install.
		expect(readDisk()).toEqual({ taskTag: "task", starterNoteCreated: true });
	});

	it("keeps later settings saves free of device-local values", async () => {
		const { plugin, secrets, local, readDisk } = createPlugin({ taskTag: "task" });
		await plugin.loadSettings();

		plugin.settings.apiAuthToken = "generated-token";
		plugin.settings.lastSeenVersion = "5.0.0";
		await plugin.saveSettings();

		const disk = readDisk() ?? {};
		expect(disk).not.toHaveProperty("apiAuthToken");
		expect(disk).not.toHaveProperty("lastSeenVersion");
		expect(disk.taskTag).toBe("task");
		expect(secrets.get(API_AUTH_TOKEN_SECRET_ID)).toBe("generated-token");
		expect(local.get("tasknotes-last-seen-version")).toBe("5.0.0");
	});

	it("does not rewrite data.json synced from a v4 device", async () => {
		// v4 adds these back whenever it reloads settings; writing them away again on
		// every synced change kept two devices rewriting data.json indefinitely.
		const synced = { apiAuthToken: "", lastSeenVersion: "4.5.0", googleOAuthClientId: "", taskTag: "task" };
		const { plugin, secrets, saveData } = createPlugin(synced);
		secrets.set(API_AUTH_TOKEN_SECRET_ID, "this-device-token");

		await plugin.loadSettings(true);
		await new Promise((resolve) => setTimeout(resolve, 150));

		expect(saveData.mock.contexts).not.toContain(plugin);
		expect(plugin.settings.apiAuthToken).toBe("this-device-token");
		expect(plugin.settings.taskTag).toBe("task");
	});

	it("does not treat a synced vault on a new device as a new install", async () => {
		const { plugin } = createPlugin({ taskTag: "task" });

		await plugin.loadSettings();

		expect(plugin.settings.lastSeenVersion).toBeUndefined();
		expect(plugin.isNewInstall).toBe(false);
	});
});
