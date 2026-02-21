import { normalizePath } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { PomodoroState } from "../types";
import type { TaskNotesSettings } from "../types/settings";

export type SessionStateStorageLocation = "plugin" | "state-file" | "localStorage";

export interface SessionStateData {
	pomodoroState?: PomodoroState;
	lastPomodoroDate?: string;
	lastSelectedTaskPath?: string;
}

const SESSION_STATE_KEYS: (keyof SessionStateData)[] = [
	"pomodoroState",
	"lastPomodoroDate",
	"lastSelectedTaskPath",
];

function hasAnySessionState(data: SessionStateData | undefined | null): boolean {
	if (!data) return false;
	return SESSION_STATE_KEYS.some((key) => typeof data[key] !== "undefined");
}

export class SessionStateStorage {
	constructor(private plugin: TaskNotesPlugin) {}

	getLocation(): SessionStateStorageLocation {
		return this.plugin.settings.sessionStateStorageLocation;
	}

	getStateFilePath(): string {
		const dir = (this.plugin.manifest as any)?.dir as string | undefined;
		const base = dir && dir.trim().length > 0 ? dir : ".obsidian/plugins/tasknotes";
		return normalizePath(`${base}/state.json`);
	}

	private getVaultName(): string {
		try {
			const vault = this.plugin.app?.vault;
			if (vault && typeof vault.getName === "function") {
				return vault.getName() || "default";
			}
		} catch {
			// ignore
		}
		return "default";
	}

	private getLocalStorageKey(): string {
		return `tasknotes:${this.getVaultName()}:session-state`;
	}

	private async loadFromPluginData(): Promise<SessionStateData> {
		const data = (await this.plugin.loadData()) || {};
		const out: SessionStateData = {};
		for (const key of SESSION_STATE_KEYS) {
			if (typeof (data as any)[key] !== "undefined") {
				(out as any)[key] = (data as any)[key];
			}
		}
		return out;
	}

	private async saveToPluginData(partial: SessionStateData): Promise<void> {
		const data = (await this.plugin.loadData()) || {};
		for (const key of SESSION_STATE_KEYS) {
			if (typeof (partial as any)[key] !== "undefined") {
				(data as any)[key] = (partial as any)[key];
			}
		}
		await this.plugin.saveData(data);
	}

	async stripSessionStateFromPluginData(force = false): Promise<void> {
		const location = this.getLocation();
		if (!force && location === "plugin") return;

		try {
			const data = (await this.plugin.loadData()) || {};
			let changed = false;
			for (const key of SESSION_STATE_KEYS) {
				if (key in (data as any)) {
					delete (data as any)[key];
					changed = true;
				}
			}
			if (changed) {
				await this.plugin.saveData(data);
			}
		} catch {
			// ignore
		}
	}

	private async loadFromStateFile(): Promise<SessionStateData> {
		const adapter = this.plugin.app.vault.adapter;
		const path = this.getStateFilePath();
		if (!(await adapter.exists(path))) return {};
		try {
			const raw = await adapter.read(path);
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === "object" ? (parsed as SessionStateData) : {};
		} catch {
			return {};
		}
	}

	private async saveToStateFile(partial: SessionStateData): Promise<void> {
		const adapter = this.plugin.app.vault.adapter;
		const path = this.getStateFilePath();
		const existing = await this.loadFromStateFile();
		const merged = { ...existing, ...partial };
		await adapter.write(path, JSON.stringify(merged, null, 2));
	}

	private loadFromLocalStorage(): SessionStateData {
		try {
			if (typeof window === "undefined") return {};
			const storage = window.localStorage;
			if (!storage) return {};
			const raw = storage.getItem(this.getLocalStorageKey());
			if (!raw) return {};
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === "object" ? (parsed as SessionStateData) : {};
		} catch {
			return {};
		}
	}

	private saveToLocalStorage(partial: SessionStateData): void {
		try {
			if (typeof window === "undefined") return;
			const storage = window.localStorage;
			if (!storage) return;
			const existing = this.loadFromLocalStorage();
			const merged = { ...existing, ...partial };
			storage.setItem(this.getLocalStorageKey(), JSON.stringify(merged));
		} catch {
			// ignore
		}
	}

	private removeFromLocalStorage(): void {
		try {
			if (typeof window === "undefined") return;
			const storage = window.localStorage;
			if (!storage) return;
			storage.removeItem(this.getLocalStorageKey());
		} catch {
			// ignore
		}
	}

	async load(): Promise<SessionStateData> {
		const location = this.getLocation();
		if (location === "plugin") return this.loadFromPluginData();
		if (location === "state-file") return this.loadFromStateFile();
		return this.loadFromLocalStorage();
	}

	async save(partial: SessionStateData): Promise<void> {
		const location = this.getLocation();
		if (location === "plugin") {
			await this.saveToPluginData(partial);
			return;
		}

		if (location === "state-file") {
			await this.saveToStateFile(partial);
		} else {
			this.saveToLocalStorage(partial);
		}

		await this.stripSessionStateFromPluginData();
	}

	/**
	 * One-time migration: if the chosen location is not plugin data, and plugin data
	 * still contains session state, copy it into the chosen location and strip it
	 * from plugin data.
	 */
	async migrateFromPluginDataIfNeeded(): Promise<void> {
		const location = this.getLocation();
		if (location === "plugin") return;

		const legacy = await this.loadFromPluginData();
		if (!hasAnySessionState(legacy)) return;

		const current = await this.load();
		if (!hasAnySessionState(current)) {
			await this.save(legacy);
		} else {
			// Still strip to avoid sync noise
			await this.stripSessionStateFromPluginData();
		}
	}

	async migrateLocation(
		from: TaskNotesSettings["sessionStateStorageLocation"],
		to: TaskNotesSettings["sessionStateStorageLocation"]
	): Promise<void> {
		if (from === to) return;

		const readFrom = async (loc: SessionStateStorageLocation) => {
			if (loc === "plugin") return this.loadFromPluginData();
			if (loc === "state-file") return this.loadFromStateFile();
			return this.loadFromLocalStorage();
		};

		const writeTo = async (loc: SessionStateStorageLocation, data: SessionStateData) => {
			if (loc === "plugin") return this.saveToPluginData(data);
			if (loc === "state-file") return this.saveToStateFile(data);
			return this.saveToLocalStorage(data);
		};

		const clearFrom = async (loc: SessionStateStorageLocation) => {
			if (loc === "plugin") {
				// Delete keys from plugin data
				try {
					const data = (await this.plugin.loadData()) || {};
					let changed = false;
					for (const key of SESSION_STATE_KEYS) {
						if (key in (data as any)) {
							delete (data as any)[key];
							changed = true;
						}
					}
					if (changed) await this.plugin.saveData(data);
				} catch {
					// ignore
				}
				return;
			}

			if (loc === "state-file") {
				try {
					const adapter = this.plugin.app.vault.adapter;
					const path = this.getStateFilePath();
					if (await adapter.exists(path)) await adapter.remove(path);
				} catch {
					// ignore
				}
				return;
			}

			this.removeFromLocalStorage();
		};

		const data = await readFrom(from);
		await writeTo(to, data);
		await clearFrom(from);
		if (to !== "plugin") {
			await this.stripSessionStateFromPluginData(true);
		}
	}
}
