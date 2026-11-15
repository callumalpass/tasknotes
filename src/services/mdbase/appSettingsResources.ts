import { TASKNOTES_SETTINGS_PATH, TASKNOTES_SETTINGS_TYPE, TASKNOTES_SETTINGS_APP, TASKNOTES_SETTINGS_TYPE_VERSION, legacyAppSettingsPath } from "@tasknotes/model/settings";
import { canonicalTaskNotesResources } from "../canonicalTaskNotesPack";

/** The TaskNotes settings record, relative to the collection root. */
export const APP_SETTINGS_RECORD_PATH = TASKNOTES_SETTINGS_PATH;
export const LEGACY_APP_SETTINGS_RECORD_PATH = legacyAppSettingsPath(TASKNOTES_SETTINGS_APP);

export function isAppSettingsRecordPath(path: string): boolean {
	return path === APP_SETTINGS_RECORD_PATH || path === LEGACY_APP_SETTINGS_RECORD_PATH;
}

export type AppSettingsSupportResource = {
	path: string;
	content: string;
	/** Seeded once: an existing file (for example from TaskNotes App) is kept. */
	seed: boolean;
};

const CONTRACTS = ["mdbase.app-settings", "tasknotes.settings"] as const;

function document(source: string): string {
	const resource = canonicalTaskNotesResources.find((entry) => entry.source === source);
	if (!resource) throw new Error(`Missing canonical TaskNotes resource: ${source}`);
	return resource.document;
}

/**
 * Where contract-relative schemas live: the contracts reference
 * `../../schemas/<id>/<version>.schema.json`, beside the contracts folder.
 */
export function appSettingsSchemasFolder(contractsFolder: string): string {
	const parent = contractsFolder.split("/").slice(0, -1).join("/");
	return parent ? `${parent}/schemas` : "schemas";
}

/**
 * The settings contracts, their schemas and the tasknotes-settings type, laid
 * out as the tasknotes.task 0.3.0-rc.21 pack installs them.
 */
export function appSettingsSupportResources(
	contractsFolder: string,
	typesFolder: string
): AppSettingsSupportResource[] {
	const schemas = appSettingsSchemasFolder(contractsFolder);
	return [
		...canonicalTaskNotesResources
			.filter(({ source }) => CONTRACTS.some((id) =>
				source.startsWith(`schemas/${id}/`) || source.startsWith(`contracts/${id}/`)))
			.map(({ source, document: content }) => ({
				path: source.startsWith("schemas/")
					? `${schemas}/${source.slice("schemas/".length)}`
					: `${contractsFolder}/${source.slice("contracts/".length)}`,
				content,
				seed: false,
			})),
		{ path: `${typesFolder}/${TASKNOTES_SETTINGS_TYPE}.md`, content: document(`types/tasknotes-settings/${TASKNOTES_SETTINGS_TYPE_VERSION}.md`), seed: true },
	];
}

/** Whether a path is one the settings support resources or record may occupy. */
export function isAppSettingsMetadataPath(path: string, contractsFolder: string, typesFolder: string): boolean {
	return (
		isAppSettingsRecordPath(path) ||
		appSettingsSupportResources(contractsFolder, typesFolder).some((resource) => resource.path === path)
	);
}
