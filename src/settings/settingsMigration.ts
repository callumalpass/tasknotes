import { DEFAULT_SETTINGS } from "./defaults";
import type { TaskNotesSettings } from "../types/settings";

type MigrationSettingsData = Partial<
	Pick<TaskNotesSettings, "fieldMapping" | "calendarViewSettings" | "commandFileMapping">
>;

function hasOwnKey(value: unknown, key: string): boolean {
	return (
		value !== null &&
		typeof value === "object" &&
		Object.prototype.hasOwnProperty.call(value, key)
	);
}

function hasMissingDefaultKeys(defaults: object, loaded: unknown): boolean {
	return Object.keys(defaults).some((key) => !hasOwnKey(loaded, key));
}

export function hasMissingMigratedSettings(data: MigrationSettingsData | null | undefined): boolean {
	if (!data) {
		return false;
	}

	return (
		hasMissingDefaultKeys(DEFAULT_SETTINGS.fieldMapping, data.fieldMapping) ||
		hasMissingDefaultKeys(DEFAULT_SETTINGS.calendarViewSettings, data.calendarViewSettings) ||
		hasMissingDefaultKeys(DEFAULT_SETTINGS.commandFileMapping, data.commandFileMapping)
	);
}
