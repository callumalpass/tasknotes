import type { RelationshipsDisplayMode, TaskNotesSettings } from "../types/settings";

function isRelationshipsDisplayMode(value: unknown): value is RelationshipsDisplayMode {
	return value === "always" || value === "whenPopulated" || value === "never";
}

export function getRelationshipsDisplayMode(
	settings: Pick<TaskNotesSettings, "showRelationships" | "relationshipsDisplayMode">
): RelationshipsDisplayMode {
	if (settings.showRelationships === false) {
		return "never";
	}

	return isRelationshipsDisplayMode(settings.relationshipsDisplayMode)
		? settings.relationshipsDisplayMode
		: "always";
}
