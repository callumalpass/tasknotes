import {
	App,
	type SettingDefinitionItem,
	type SettingDefinitionControl,
	type SettingDefinitionList,
	type SettingDefinitionPage,
} from "obsidian";
import type TaskNotesPlugin from "../../src/main";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";
import { createI18nService } from "../../src/i18n";
import { TaskNotesSettingTab } from "../../src/settings/TaskNotesSettingTab";
import { SettingsContext } from "../../src/settings/native/SettingsContext";

if (!globalThis.structuredClone)
	globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
if (!crypto.randomUUID)
	Object.defineProperty(crypto, "randomUUID", { value: require("crypto").randomUUID });

export function settingsFixture() {
	const app = new App();
	Object.assign(app, { setting: undefined });
	const plugin = {
		app,
		settings: structuredClone(DEFAULT_SETTINGS),
		i18n: createI18nService(),
		manifest: { version: "5.0.0-test" },
		registerEvent: jest.fn(),
		emitter: { on: jest.fn() },
		saveSettings: jest.fn().mockResolvedValue(undefined),
		saveData: jest.fn(),
		loadData: jest.fn().mockResolvedValue({}),
		fieldMapper: { toUserField: (key: string) => key },
		statusBarService: { updateVisibility: jest.fn() },
		pomodoroService: { migrateTodailyNotes: jest.fn().mockResolvedValue(undefined) },
	} as unknown as TaskNotesPlugin;
	const tab = new TaskNotesSettingTab(app, plugin);
	const ctx = new SettingsContext(plugin, jest.fn(), jest.fn());
	return { app, plugin, tab, ctx };
}

export function flattenSettings(items: SettingDefinitionItem[]): SettingDefinitionItem[] {
	return items.flatMap((item) => [
		item,
		...("items" in item && item.items ? flattenSettings(item.items) : []),
	]);
}
export function control(items: SettingDefinitionItem[], key: string): SettingDefinitionControl {
	const match = flattenSettings(items).find(
		(item) => "control" in item && item.control?.key === key
	);
	if (!match) throw new Error(`Missing setting: ${key}`);
	return match as SettingDefinitionControl;
}
export function page(items: SettingDefinitionItem[], name: string): SettingDefinitionPage {
	const match = flattenSettings(items).find(
		(item) => "type" in item && item.type === "page" && item.name === name
	);
	if (!match) throw new Error(`Missing page: ${name}`);
	return match as SettingDefinitionPage;
}
export function list(items: SettingDefinitionItem[], heading: string): SettingDefinitionList {
	const match = flattenSettings(items).find(
		(item) => "type" in item && item.type === "list" && item.heading === heading
	);
	if (!match) throw new Error(`Missing list: ${heading}`);
	return match as SettingDefinitionList;
}
export const settle = async () => {
	for (let i = 0; i < 20; i++) await Promise.resolve();
};
