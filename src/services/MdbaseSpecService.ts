import { Modal, normalizePath, type TAbstractFile, TFile } from "obsidian";
import YAML from "yaml";
import {
	buildTaskNotesMdbaseResources,
	type TaskNotesMdbaseResources,
} from "@tasknotes/model/mdbase";
import { TASKNOTES_SPEC_VERSION as TASKNOTES_CONTRACT_VERSION } from "@tasknotes/model";

import TaskNotesPlugin from "../main";
import { FieldMapping } from "../types";
import { UserMappedField } from "../types/settings";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { publishUserNotice } from "../core/userNotices";
import {
	applyCanonicalTaskTypeToSettings,
	buildTaskNotesModelConfig,
	mergeCanonicalTaskTypeDocument,
	parseMdbaseTaskTypeDocument,
	portableSettingsFingerprint,
	type ParsedMdbaseTaskType,
	validateCanonicalTaskType,
} from "./mdbaseCanonicalConfig";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/MdbaseSpecService" });

const DEFAULT_TYPES_FOLDER = "_types";
const DEFAULT_CONTRACTS_FOLDER = "_contracts";
const MDBASE_V03_SPEC_VERSION = "0.3.0";
const MDBASE_MIGRATION_BACKUP_FOLDER = ".tasknotes/migrations";
const MDBASE_MIGRATION_PENDING_PATH = `${MDBASE_MIGRATION_BACKUP_FOLDER}/mdbase-v0.2-pending.json`;

type SupportedSpecFamily = "v0.2" | "v0.3";

type MdbaseYamlConfig = {
	spec_version?: unknown;
	settings?: Record<string, unknown> & {
		types_folder?: unknown;
		contracts_folder?: unknown;
	};
	"x-legacy-v0.2"?: unknown;
};

type TypeGenerationOptions = {
	legacyCompatibility?: boolean;
};

type ExistingCollection = {
	exists: boolean;
	config: MdbaseYamlConfig | null;
};

type CanonicalTypeState = {
	path: string;
	content: string;
	type: Record<string, unknown>;
};

type LegacyTaskNotesTypeState = {
	path: string;
	content: string;
	typeName: string;
};

type FileSnapshot = {
	path: string;
	content: string | null;
};

type MigrationJournal = {
	backupFolder: string;
	snapshots: FileSnapshot[];
	intendedWrites: FileSnapshot[];
};

type ConflictChoice = "type" | "settings";

class MdbaseConfigurationConflictModal extends Modal {
	private settled = false;

	constructor(
		app: TaskNotesPlugin["app"],
		private readonly typePath: string,
		private readonly invalidType: boolean,
		private readonly resolveChoice: (choice: ConflictChoice) => void
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText("Configuration conflict");
		this.contentEl.createEl("p", {
			text: this.invalidType
				? `${this.typePath} is not a valid TaskNotes contract. TaskNotes kept its last-known-good settings.`
				: `${this.typePath} and TaskNotes settings both changed since they were last synchronized.`,
		});
		this.contentEl.createEl("p", {
			text: this.invalidType
				? "Keep the file unchanged so you can repair it manually, or replace its managed TaskNotes fields with the current settings."
				: "Choose which version should become canonical. Unknown mdbase extensions will be preserved.",
		});

		const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
		const useTypeButton = actions.createEl("button", {
			text: this.invalidType ? "Keep file unchanged" : "Use mdbase type",
		});
		useTypeButton.addEventListener("click", () => this.finish("type"));

		const useSettingsButton = actions.createEl("button", {
			text: this.invalidType ? "Repair from TaskNotes" : "Use TaskNotes settings",
		});
		useSettingsButton.addClass("mod-cta");
		useSettingsButton.addEventListener("click", () => this.finish("settings"));
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.settled) {
			this.settled = true;
			this.resolveChoice("type");
		}
	}

	private finish(choice: ConflictChoice): void {
		if (this.settled) return;
		this.settled = true;
		this.resolveChoice(choice);
		this.close();
	}
}

/**
 * Service that owns the mdbase collection binding and canonical TaskNotes type
 * (mdbase.yaml at the vault root and a TaskNotes contract in the configured
 * types folder).
 *
 * New collections use v0.3. TaskNotes-generated v0.2 collections are upgraded
 * automatically when ownership is unambiguous; other v0.2 collections remain
 * untouched. V0.3 types are loaded into the effective portable settings and
 * receive write-through settings updates. Files are NOT deleted when the
 * feature is disabled.
 */
export class MdbaseSpecService {
	private plugin: TaskNotesPlugin;
	private canonicalTypePath: string | null = null;
	private canonicalTypesFolder: string | null = null;
	private canonicalResourcePaths = new Set<string>();
	private lastKnownTypeContent: string | null = null;
	private lastAppliedSettingsFingerprint: string | null = null;
	private canonicalReadBlocked = false;
	private watcherRegistered = false;
	private reconcileRequested = false;
	private reconcilePromise: Promise<void> | null = null;
	private writeInProgress = false;
	private pendingUserNotices: string[] = [];

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Load an enabled v0.3 TaskNotes type before runtime services capture their
	 * settings, upgrading clearly TaskNotes-owned v0.2 metadata first.
	 */
	async initialize(): Promise<void> {
		if (!this.plugin.settings.enableMdbaseSpec) {
			return;
		}

		try {
			await this.recoverInterruptedV02Migration();
			const existingCollection = await this.readExistingCollection();
			const specFamily = getSpecFamily(existingCollection.config?.spec_version);
			if (!existingCollection.exists) {
				await this.syncSettingsToCanonicalType(existingCollection);
			} else if (specFamily === "v0.3") {
				const state = await this.readCanonicalType(existingCollection);
				if (state) {
					this.applyCanonicalState(state);
				} else {
					await this.syncSettingsToCanonicalType(existingCollection);
				}
			} else if (specFamily === "v0.2") {
				await this.migrateGeneratedV02Collection(existingCollection);
			} else if (!specFamily) {
				this.reportInvalidCanonicalType(
					"mdbase.yaml has an unreadable or unsupported spec version."
				);
			}
		} catch (error) {
			tasknotesLogger.error("[TaskNotes][mdbase] Failed to initialize canonical settings.", {
				category: "configuration",
				operation: "canonical-settings-initialize",
				error,
			});
			this.publishNotice(
				"TaskNotes could not initialize the canonical mdbase configuration. Plugin settings remain active."
			);
		} finally {
			this.registerCanonicalWatchers();
		}
	}

	/**
	 * Upgrade metadata generated and owned by TaskNotes from mdbase v0.2 to
	 * canonical v0.3. Task records are never read or written by this migration.
	 * Ambiguous collections are left unchanged.
	 */
	private async migrateGeneratedV02Collection(
		existingCollection: ExistingCollection
	): Promise<boolean> {
		const legacyType = await this.readGeneratedV02TaskType(existingCollection);
		if (!legacyType) {
			this.publishNotice(
				"TaskNotes left the existing mdbase v0.2 collection unchanged because it could not confirm that the active type files are generated solely by TaskNotes."
			);
			return false;
		}

		const typesFolder = this.resolveTypesFolder(existingCollection);
		const contractsFolder = this.resolveContractsFolder(existingCollection);
		const resources = this.buildCanonicalMdbaseResources(
			typesFolder,
			true,
			legacyType.typeName,
			contractsFolder
		);
		for (const path of [
			resources.paths.contract,
			resources.paths.taskSchema,
			resources.paths.bindingSchema,
		]) {
			if (await this.plugin.app.vault.adapter.exists(path)) {
				this.publishNotice(
					`TaskNotes left the mdbase v0.2 collection unchanged because ${path} already exists and may be user-maintained.`
				);
				return false;
			}
		}
		const sourceConfig = await this.plugin.app.vault.adapter.read("mdbase.yaml");
		const migratedConfig = this.buildMigratedV03Config(
			existingCollection.config ?? {},
			resources,
			legacyType.path
		);
		const managedPaths = [
			resources.paths.contract,
			resources.paths.taskSchema,
			resources.paths.bindingSchema,
			legacyType.path,
			"mdbase.yaml",
		];
		const snapshots = await this.snapshotFiles(managedPaths);
		if (
			snapshots.find(({ path }) => path === "mdbase.yaml")?.content !== sourceConfig ||
			snapshots.find(({ path }) => path === legacyType.path)?.content !== legacyType.content ||
			snapshots.some(
				({ path, content }) =>
					path !== "mdbase.yaml" && path !== legacyType.path && content !== null
			)
		) {
			this.publishNotice(
				"TaskNotes left the mdbase v0.2 collection unchanged because its metadata changed while the upgrade was being prepared."
			);
			return false;
		}
		const intendedWrites: FileSnapshot[] = [
			{ path: resources.paths.contract, content: resources.contractDocument },
			{ path: resources.paths.taskSchema, content: resources.taskSchemaDocument },
			{ path: resources.paths.bindingSchema, content: resources.bindingSchemaDocument },
			{ path: legacyType.path, content: resources.typeDocument },
			{ path: "mdbase.yaml", content: migratedConfig },
		];
		const backupFolder = await this.writeV02MigrationBackup(sourceConfig, legacyType);
		const journal: MigrationJournal = { backupFolder, snapshots, intendedWrites };
		await this.writeMigrationJournal(journal);

		this.writeInProgress = true;
		try {
			await this.assertSnapshotsUnchanged(snapshots);
			for (const intendedWrite of intendedWrites) {
				const snapshot = snapshots.find(({ path }) => path === intendedWrite.path);
				if (!snapshot || intendedWrite.content === null) {
					throw new Error(`Invalid migration write plan for ${intendedWrite.path}`);
				}
				await this.writeFileIfUnchanged(snapshot, intendedWrite.content);
				if (
					intendedWrite.path === resources.paths.contract ||
					intendedWrite.path === resources.paths.taskSchema ||
					intendedWrite.path === resources.paths.bindingSchema
				) {
					this.canonicalResourcePaths.add(intendedWrite.path);
				}
			}
			const state = await this.verifyMigratedV03Collection(legacyType.path, resources);
			await this.removeMigrationJournal();
			this.canonicalTypesFolder = typesFolder;
			this.applyCanonicalState(state);
			this.publishNotice(
				`TaskNotes updated its mdbase metadata to v0.3. Task files were not changed. The previous metadata is backed up in ${backupFolder}.`
			);
			tasknotesLogger.debug("[TaskNotes][mdbase] Migrated generated v0.2 metadata.", {
				category: "configuration",
				operation: "migrate-generated-v02",
				details: { typePath: legacyType.path, backupFolder },
			});
			return true;
		} catch (error) {
			let rollbackError: unknown = null;
			try {
				await this.restoreSnapshotsIfUnchanged(journal);
				await this.removeMigrationJournal();
			} catch (restoreError) {
				rollbackError = restoreError;
			}
			this.clearCanonicalState();
			tasknotesLogger.error("[TaskNotes][mdbase] Rolled back v0.2 metadata migration.", {
				category: "configuration",
				operation: "migrate-generated-v02-rollback",
				error,
				details: { backupFolder, rollbackError },
			});
			if (rollbackError) {
				this.publishNotice(
					`TaskNotes stopped the mdbase update after another change was detected. It did not overwrite that change; recovery copies and the pending migration record are in ${backupFolder}.`
				);
			} else {
				this.publishNotice(
					`TaskNotes could not update the mdbase metadata and restored the v0.2 files. A backup is available in ${backupFolder}.`
				);
			}
			return false;
		} finally {
			this.writeInProgress = false;
		}
	}

	private async readGeneratedV02TaskType(
		existingCollection: ExistingCollection
	): Promise<LegacyTaskNotesTypeState | null> {
		const typesFolder = this.resolveTypesFolder(existingCollection);
		const typePath = `${typesFolder}/task.md`;
		const adapter = this.plugin.app.vault.adapter;
		if (!(await adapter.exists(typePath))) return null;

		const otherMarkdownTypes = (await this.listMarkdownFilesRecursively(typesFolder)).filter(
			(path) => path !== typePath
		);
		if (otherMarkdownTypes.length > 0) return null;

		const content = await adapter.read(typePath);
		let parsed: ParsedMdbaseTaskType;
		try {
			parsed = parseMdbaseTaskTypeDocument(content);
		} catch {
			return null;
		}
		if (!isUnmodifiedGeneratedV02Type(content, this.buildTaskTypeDefV02())) return null;

		return {
			path: typePath,
			content,
			typeName: typeof parsed.type.name === "string" ? parsed.type.name : "task",
		};
	}

	private async listMarkdownFilesRecursively(folder: string): Promise<string[]> {
		const adapter = this.plugin.app.vault.adapter;
		const pending = [folder];
		const visited = new Set<string>();
		const files: string[] = [];
		while (pending.length > 0) {
			const current = pending.pop();
			if (!current || visited.has(current)) continue;
			visited.add(current);
			const listing = await adapter.list(current);
			files.push(...listing.files.filter((path) => path.endsWith(".md")));
			pending.push(...listing.folders);
		}
		return files;
	}

	private buildMigratedV03Config(
		source: MdbaseYamlConfig,
		resources: TaskNotesMdbaseResources,
		sourceTypePath: string
	): string {
		const generated = YAML.parse(resources.configDocument) as unknown;
		if (!isRecord(generated) || !isRecord(generated.settings)) {
			throw new Error("TaskNotes generated an invalid canonical mdbase configuration.");
		}
		const sourceSettings = isRecord(source.settings) ? source.settings : {};
		const generatedSettings = generated.settings;
		const typesFolder = resources.paths.type.split("/").slice(0, -1).join("/");
		const contractsFolder = resources.paths.contract.split("/").slice(0, -1).join("/");
		const exclude = uniqueStrings([
			...stringValues(generatedSettings.exclude),
			...stringValues(sourceSettings.exclude),
			typesFolder,
		]);
		const previousLegacy = isRecord(source["x-legacy-v0.2"])
			? source["x-legacy-v0.2"]
			: {};
		const previousTaskNotesMigration = isRecord(previousLegacy.tasknotes_metadata_migration)
			? previousLegacy.tasknotes_metadata_migration
			: {};
		const migrated: Record<string, unknown> = {
			...generated,
			...source,
			spec_version: MDBASE_V03_SPEC_VERSION,
			settings: {
				...generatedSettings,
				...sourceSettings,
				types_folder: typesFolder,
				contracts_folder: contractsFolder,
				record_extensions:
					sourceSettings.record_extensions ?? generatedSettings.record_extensions,
				exclude,
			},
			"x-legacy-v0.2": {
				...previousLegacy,
				tasknotes_metadata_migration: {
					...previousTaskNotesMigration,
					source_spec_version: source.spec_version,
					source_type_path: sourceTypePath,
					coercion_compatible_schema: true,
				},
			},
		};

		return YAML.stringify(migrated);
	}

	private async snapshotFiles(paths: string[]): Promise<FileSnapshot[]> {
		const adapter = this.plugin.app.vault.adapter;
		const snapshots: FileSnapshot[] = [];
		for (const path of uniqueStrings(paths)) {
			snapshots.push({
				path,
				content: (await adapter.exists(path)) ? await adapter.read(path) : null,
			});
		}
		return snapshots;
	}

	private async assertSnapshotsUnchanged(snapshots: FileSnapshot[]): Promise<void> {
		const current = await this.snapshotFiles(snapshots.map(({ path }) => path));
		for (const snapshot of snapshots) {
			if (current.find(({ path }) => path === snapshot.path)?.content !== snapshot.content) {
				throw new Error(`The mdbase file changed during migration: ${snapshot.path}`);
			}
		}
	}

	private async restoreSnapshotsIfUnchanged(journal: MigrationJournal): Promise<void> {
		const intended = new Map(journal.intendedWrites.map(({ path, content }) => [path, content]));
		const current = await this.snapshotFiles(journal.snapshots.map(({ path }) => path));
		for (const snapshot of journal.snapshots) {
			const currentContent = current.find(({ path }) => path === snapshot.path)?.content ?? null;
			if (currentContent !== snapshot.content && currentContent !== intended.get(snapshot.path)) {
				throw new Error(`Refusing to overwrite a concurrent change to ${snapshot.path}`);
			}
		}
		for (const snapshot of [...journal.snapshots].reverse()) {
			const currentContent = current.find(({ path }) => path === snapshot.path)?.content ?? null;
			if (currentContent === snapshot.content) continue;
			if (snapshot.content === null) {
				// Never delete a newly created support resource during rollback: an
				// external process could have changed it after our last comparison.
				// Leaving an orphaned generated file is safer than risking user data.
				continue;
			} else {
				await this.writeFileIfUnchanged(
					{ path: snapshot.path, content: currentContent },
					snapshot.content
				);
			}
		}
	}

	private async writeMigrationJournal(journal: MigrationJournal): Promise<void> {
		await this.ensureFolderPath(MDBASE_MIGRATION_BACKUP_FOLDER);
		if (await this.plugin.app.vault.adapter.exists(MDBASE_MIGRATION_PENDING_PATH)) {
			throw new Error("An unresolved mdbase metadata migration is already pending.");
		}
		await this.plugin.app.vault.create(
			MDBASE_MIGRATION_PENDING_PATH,
			JSON.stringify(journal, null, 2) + "\n"
		);
	}

	private async removeMigrationJournal(): Promise<void> {
		if (await this.plugin.app.vault.adapter.exists(MDBASE_MIGRATION_PENDING_PATH)) {
			await this.plugin.app.vault.adapter.remove(MDBASE_MIGRATION_PENDING_PATH);
		}
	}

	private async recoverInterruptedV02Migration(): Promise<void> {
		const adapter = this.plugin.app.vault.adapter;
		if (!(await adapter.exists(MDBASE_MIGRATION_PENDING_PATH))) return;
		try {
			const parsed = JSON.parse(await adapter.read(MDBASE_MIGRATION_PENDING_PATH)) as unknown;
			const journal = parseMigrationJournal(parsed);
			const configSnapshot = journal.snapshots.find(({ path }) => path === "mdbase.yaml");
			const typeSnapshot = journal.snapshots.find(({ path }) => path.endsWith("/task.md"));
			if (
				!configSnapshot?.content ||
				!typeSnapshot?.content ||
				(await adapter.read(`${journal.backupFolder}/mdbase.yaml.bak`)) !==
					configSnapshot.content ||
				(await adapter.read(`${journal.backupFolder}/task.md.bak`)) !== typeSnapshot.content
			) {
				throw new Error("The migration recovery copies do not match the pending record.");
			}
			await this.restoreSnapshotsIfUnchanged(journal);
			await this.removeMigrationJournal();
			this.publishNotice(
				`TaskNotes restored an interrupted mdbase v0.2 metadata migration. Recovery copies remain in ${journal.backupFolder}.`
			);
		} catch (error) {
			tasknotesLogger.error("[TaskNotes][mdbase] Could not recover interrupted migration.", {
				category: "configuration",
				operation: "recover-v02-migration",
				error,
			});
			throw new Error(
				`An interrupted mdbase migration needs manual review; TaskNotes left all files unchanged: ${String(error)}`
			);
		}
	}

	private async writeV02MigrationBackup(
		configContent: string,
		legacyType: LegacyTaskNotesTypeState
	): Promise<string> {
		const suffix = new Date().toISOString().replace(/[:.]/g, "-");
		const baseFolder = `${MDBASE_MIGRATION_BACKUP_FOLDER}/mdbase-v0.2-${suffix}`;
		let folder = baseFolder;
		let attempt = 2;
		while (await this.plugin.app.vault.adapter.exists(folder)) {
			folder = `${baseFolder}-${attempt}`;
			attempt += 1;
		}
		await this.ensureFolderPath(folder);
		await this.plugin.app.vault.create(`${folder}/mdbase.yaml.bak`, configContent);
		await this.plugin.app.vault.create(`${folder}/task.md.bak`, legacyType.content);
		await this.plugin.app.vault.create(
			`${folder}/manifest.json`,
			JSON.stringify(
				{
					created_at: new Date().toISOString(),
					source_spec_version: "0.2",
					files: {
						"mdbase.yaml": "mdbase.yaml.bak",
						[legacyType.path]: "task.md.bak",
					},
				},
				null,
				2
			) + "\n"
		);
		return folder;
	}

	private async verifyMigratedV03Collection(
		typePath: string,
		resources: TaskNotesMdbaseResources
	): Promise<CanonicalTypeState> {
		const adapter = this.plugin.app.vault.adapter;
		const config = YAML.parse(await adapter.read("mdbase.yaml")) as unknown;
		if (!isRecord(config) || getSpecFamily(config.spec_version) !== "v0.3") {
			throw new Error("The migrated mdbase.yaml did not load as v0.3.");
		}
		const content = await adapter.read(typePath);
		const parsed = parseMdbaseTaskTypeDocument(content);
		const validation = validateCanonicalTaskType(parsed.type);
		if (!hasTaskNotesImplementation(parsed.type) || !validation.valid) {
			throw new Error(
				`The generated TaskNotes v0.3 type failed validation${
					validation.valid ? "." : `: ${validation.issues.join("; ")}`
				}`
			);
		}
		const contract = parseMdbaseTaskTypeDocument(
			await adapter.read(resources.paths.contract)
		).type;
		if (contract.kind !== "mdbase.contract" || contract.id !== "tasknotes.task") {
			throw new Error("The generated TaskNotes data contract failed read-back validation.");
		}
		for (const schemaPath of [resources.paths.taskSchema, resources.paths.bindingSchema]) {
			const schema = JSON.parse(await adapter.read(schemaPath)) as unknown;
			if (!isRecord(schema) || schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
				throw new Error(`The generated schema at ${schemaPath} failed read-back validation.`);
			}
		}
		return { path: typePath, content, type: parsed.type };
	}

	/**
	 * Called when settings change. In canonical v0.3 collections, portable
	 * settings are written through to the type after checking for concurrent
	 * edits. Legacy v0.2 collections retain their existing generated writer.
	 */
	async onSettingsChanged(): Promise<void> {
		if (!this.plugin.settings.enableMdbaseSpec) {
			this.clearCanonicalState();
			return;
		}

		this.registerCanonicalWatchers();
		const existingCollection = await this.readExistingCollection();
		const specFamily = getSpecFamily(existingCollection.config?.spec_version);
		if (existingCollection.exists && specFamily === "v0.2") {
			await this.generate();
			return;
		}
		if (existingCollection.exists && !specFamily) {
			this.reportInvalidCanonicalType(
				"mdbase.yaml has an unreadable or unsupported spec version."
			);
			return;
		}

		await this.syncSettingsToCanonicalType(existingCollection);
	}

	async reloadCanonicalSettingsFromDisk(): Promise<void> {
		if (!this.plugin.settings.enableMdbaseSpec) return;
		const collection = await this.readExistingCollection();
		if (getSpecFamily(collection.config?.spec_version) !== "v0.3") return;
		const state = await this.readCanonicalType(collection);
		if (state) {
			this.applyCanonicalState(state);
		}
	}

	flushPendingNotices(): void {
		for (const message of this.pendingUserNotices.splice(0)) {
			publishUserNotice(this.plugin.emitter, message);
		}
	}

	/**
	 * Generate both mdbase.yaml and the task type definition.
	 */
	async generate(): Promise<void> {
		try {
			const existingCollection = await this.readExistingCollection();
			const existingSpecFamily = getSpecFamily(existingCollection.config?.spec_version);

			if (existingCollection.exists && !existingSpecFamily) {
				tasknotesLogger.warn(
					"[TaskNotes][mdbase-spec] Refusing to overwrite the generated type for an unreadable or unsupported mdbase.yaml.",
					{
						category: "configuration",
						operation: "unsupported-mdbase-version",
						details: { specVersion: existingCollection.config?.spec_version },
					}
				);
				return;
			}

			const specFamily = existingSpecFamily ?? "v0.3";
			const specVersion =
				typeof existingCollection.config?.spec_version === "string"
					? existingCollection.config.spec_version
					: MDBASE_V03_SPEC_VERSION;
			const typesFolder =
				this.normalizeTypesFolder(existingCollection.config?.settings?.types_folder) ??
				DEFAULT_TYPES_FOLDER;
			const contractsFolder =
				this.normalizeTypesFolder(
					existingCollection.config?.settings?.contracts_folder
				) ?? DEFAULT_CONTRACTS_FOLDER;
			const taskTypePath = `${typesFolder}/task.md`;

			await this.ensureFolderPath(typesFolder);

			const legacyCompatibility =
				specFamily === "v0.3" && isRecord(existingCollection.config?.["x-legacy-v0.2"]);
			let canonicalResources: TaskNotesMdbaseResources | null = null;
			if (specFamily === "v0.2") {
				await this.writeFile(taskTypePath, this.buildTaskTypeDefV02());
			} else {
				canonicalResources = this.buildCanonicalMdbaseResources(
					typesFolder,
					legacyCompatibility,
					"task",
					contractsFolder
				);
				await this.writeCanonicalSupportResources(canonicalResources);
				const written = await this.writeCanonicalType(
					taskTypePath,
					canonicalResources,
					!existingCollection.exists
				);
				if (!written) {
					return;
				}
			}

			// Only create mdbase.yaml if it doesn't already exist so that
			// user customisations (extra excludes, description, etc.) are preserved.
			if (!existingCollection.exists) {
				const mdbaseYaml =
					canonicalResources?.configDocument ?? this.buildMdbaseYaml(typesFolder);
				await this.writeFile("mdbase.yaml", mdbaseYaml);
			}

			tasknotesLogger.debug(
				`[TaskNotes][mdbase-spec] Generated ${specFamily} collection metadata and ${taskTypePath}`,
				{
					category: "configuration",
					operation: "generated-mdbase-yaml-and",
					details: { specVersion },
				}
			);
		} catch (error) {
			tasknotesLogger.error("[TaskNotes][mdbase-spec] Failed to generate files:", {
				category: "configuration",
				operation: "generate-files",
				error: error,
			});
		}
	}

	private async syncSettingsToCanonicalType(
		existingCollection: ExistingCollection
	): Promise<void> {
		const typesFolder = this.resolveTypesFolder(existingCollection);
		const contractsFolder = this.resolveContractsFolder(existingCollection);
		const legacyCompatibility = isRecord(existingCollection.config?.["x-legacy-v0.2"]);
		this.canonicalTypesFolder = typesFolder;
		await this.ensureFolderPath(typesFolder);

		const state = await this.readCanonicalType(existingCollection, false);
		if (this.canonicalReadBlocked) {
			return;
		}
		if (state) {
			await this.writeCanonicalSupportResources(
				this.buildCanonicalMdbaseResources(
					typesFolder,
					legacyCompatibility,
					typeof state.type.name === "string" ? state.type.name : "task",
					contractsFolder
				)
			);
		}
		const rememberedPath =
			this.canonicalTypePath?.startsWith(`${typesFolder}/`) === true
				? this.canonicalTypePath
				: null;
		const defaultPath = `${typesFolder}/task.md`;
		const defaultPathOccupied =
			!state && !rememberedPath && (await this.plugin.app.vault.adapter.exists(defaultPath));
		const typePath =
			state?.path ??
			rememberedPath ??
			(defaultPathOccupied ? `${typesFolder}/tasknotes-task.md` : defaultPath);
		const localFingerprint = portableSettingsFingerprint(this.plugin.settings);

		if (state) {
			if (
				this.lastKnownTypeContent === null ||
				this.lastAppliedSettingsFingerprint === null
			) {
				this.applyCanonicalState(state);
				if (!existingCollection.exists) {
					await this.writeMissingCollectionConfig(
						typesFolder,
						legacyCompatibility,
						state
					);
				}
				return;
			}
			const externalChanged =
				this.lastKnownTypeContent !== null && state.content !== this.lastKnownTypeContent;
			const localChanged =
				this.lastAppliedSettingsFingerprint !== null &&
				localFingerprint !== this.lastAppliedSettingsFingerprint;

			if (externalChanged && localChanged) {
				const choice = await this.askConflict(typePath, false);
				if (choice === "type") {
					this.applyCanonicalState(state);
					if (!existingCollection.exists) {
						await this.writeMissingCollectionConfig(
							typesFolder,
							legacyCompatibility,
							state
						);
					}
					return;
				}
				this.lastKnownTypeContent = state.content;
			} else if (externalChanged && !localChanged) {
				this.applyCanonicalState(state);
				if (!existingCollection.exists) {
					await this.writeMissingCollectionConfig(
						typesFolder,
						legacyCompatibility,
						state
					);
				}
				return;
			} else if (!externalChanged && !localChanged) {
				if (!existingCollection.exists) {
					await this.writeMissingCollectionConfig(
						typesFolder,
						legacyCompatibility,
						state
					);
				}
				return;
			}
		} else if (await this.plugin.app.vault.adapter.exists(typePath)) {
			const choice = await this.askConflict(typePath, true);
			if (choice === "type") {
				return;
			}
		}

		const typePathParts = typePath.split("/");
		const typeName =
			state && typeof state.type.name === "string"
				? state.type.name
				: (typePathParts[typePathParts.length - 1]?.replace(/\.md$/i, "") ?? "task");
		const resources = this.buildCanonicalMdbaseResources(
			typesFolder,
			legacyCompatibility,
			typeName,
			contractsFolder
		);
		await this.writeCanonicalSupportResources(resources);
		const written = await this.writeCanonicalType(typePath, resources, true);
		if (!written) return;

		if (!existingCollection.exists) {
			await this.writeFile("mdbase.yaml", resources.configDocument);
		}
	}

	private async readCanonicalType(
		existingCollection: ExistingCollection,
		reportErrors = true
	): Promise<CanonicalTypeState | null> {
		this.canonicalReadBlocked = false;
		const typesFolder = this.resolveTypesFolder(existingCollection);
		this.canonicalTypesFolder = typesFolder;
		const defaultPath = `${typesFolder}/task.md`;
		const defaultState = await this.readCanonicalTypeAtPath(defaultPath, reportErrors);
		const adapter = this.plugin.app.vault.adapter;
		if (typeof adapter.list !== "function" || !(await adapter.exists(typesFolder))) {
			return defaultState;
		}

		const listing = await adapter.list(typesFolder);
		const candidates: CanonicalTypeState[] = defaultState ? [defaultState] : [];
		for (const path of listing.files.filter((file) => file.endsWith(".md"))) {
			if (path === defaultPath) continue;
			const state = await this.readCanonicalTypeAtPath(path, false);
			if (state) candidates.push(state);
		}

		if (candidates.length > 1) {
			this.canonicalReadBlocked = true;
			if (reportErrors) {
				this.reportInvalidCanonicalType(
					`Multiple TaskNotes contracts were found in ${typesFolder}. Keep one canonical type before continuing.`
				);
			}
			return null;
		}
		return candidates[0] ?? null;
	}

	private async readCanonicalTypeAtPath(
		path: string,
		reportErrors: boolean
	): Promise<CanonicalTypeState | null> {
		const adapter = this.plugin.app.vault.adapter;
		if (!(await adapter.exists(path))) return null;

		let content: string;
		try {
			content = await adapter.read(path);
		} catch (error) {
			if (reportErrors) {
				this.reportInvalidCanonicalType(`Could not read ${path}.`, error);
			}
			return null;
		}

		try {
			const parsed = parseMdbaseTaskTypeDocument(content);
			if (!hasTaskNotesImplementation(parsed.type)) {
				return null;
			}
			const validation = validateCanonicalTaskType(parsed.type);
			if (!validation.valid) {
				this.canonicalTypePath = path;
				if (reportErrors) {
					this.reportInvalidCanonicalType(
						`${path} is inconsistent: ${validation.issues.join("; ")}`
					);
				}
				return null;
			}
			return { path, content, type: parsed.type };
		} catch (error) {
			this.canonicalTypePath = path;
			if (reportErrors) {
				this.reportInvalidCanonicalType(`${path} could not be parsed.`, error);
			}
			return null;
		}
	}

	private applyCanonicalState(state: CanonicalTypeState): void {
		applyCanonicalTaskTypeToSettings(this.plugin.settings, state.type);
		this.canonicalTypePath = state.path;
		this.lastKnownTypeContent = state.content;
		this.lastAppliedSettingsFingerprint = portableSettingsFingerprint(this.plugin.settings);
	}

	private async writeCanonicalType(
		path: string,
		resources: TaskNotesMdbaseResources,
		allowRepair: boolean
	): Promise<boolean> {
		const adapter = this.plugin.app.vault.adapter;
		const exists = await adapter.exists(path);
		let content = resources.typeDocument;

		if (exists) {
			const existing = await adapter.read(path);
			try {
				const parsed = parseMdbaseTaskTypeDocument(existing);
				const validation = validateCanonicalTaskType(parsed.type);
				if (!validation.valid && !allowRepair) {
					this.reportInvalidCanonicalType(
						`${path} is inconsistent: ${validation.issues.join("; ")}`
					);
					return false;
				}
				if (!validation.valid) {
					await this.backupInvalidType(path, existing);
				}
				content = mergeCanonicalTaskTypeDocument(existing, resources);
			} catch (error) {
				if (!allowRepair) {
					this.reportInvalidCanonicalType(
						`${path} could not be updated without replacing invalid frontmatter.`,
						error
					);
					return false;
				}
				await this.backupInvalidType(path, existing);
			}
		}

		this.writeInProgress = true;
		try {
			if (exists) {
				await adapter.write(path, content);
			} else {
				await this.plugin.app.vault.create(path, content);
			}
		} finally {
			this.writeInProgress = false;
		}

		const parsed = parseMdbaseTaskTypeDocument(content);
		this.applyCanonicalState({ path, content, type: parsed.type });
		return true;
	}

	private async backupInvalidType(path: string, content: string): Promise<void> {
		const suffix = new Date().toISOString().replace(/[:.]/g, "-");
		const backupPath = `${path}.tasknotes-backup-${suffix}`;
		await this.plugin.app.vault.create(backupPath, content);
		this.publishNotice(`TaskNotes backed up the invalid type to ${backupPath}.`);
	}

	private registerCanonicalWatchers(): void {
		if (this.watcherRegistered) return;
		const vault = this.plugin.app.vault;
		if (typeof vault.on !== "function" || typeof this.plugin.registerEvent !== "function") {
			return;
		}
		this.watcherRegistered = true;
		const handle = (file: TAbstractFile, oldPath?: string) => {
			if (
				this.writeInProgress ||
				(!this.isCanonicalPath(file.path) && (!oldPath || !this.isCanonicalPath(oldPath)))
			) {
				return;
			}
			this.requestReconciliation();
		};
		this.plugin.registerEvent(vault.on("create", (file) => handle(file)));
		this.plugin.registerEvent(vault.on("modify", (file) => handle(file)));
		this.plugin.registerEvent(vault.on("delete", (file) => handle(file)));
		this.plugin.registerEvent(vault.on("rename", (file, oldPath) => handle(file, oldPath)));
	}

	private isCanonicalPath(path: string): boolean {
		if (path === "mdbase.yaml" || path === this.canonicalTypePath) return true;
		return Boolean(
			this.canonicalTypesFolder &&
				path.startsWith(`${this.canonicalTypesFolder}/`) &&
				path.endsWith(".md")
		) || this.canonicalResourcePaths.has(path);
	}

	private requestReconciliation(): void {
		this.reconcileRequested = true;
		if (!this.reconcilePromise) {
			this.reconcilePromise = this.drainReconciliation();
		}
	}

	private async drainReconciliation(): Promise<void> {
		try {
			while (this.reconcileRequested) {
				this.reconcileRequested = false;
				try {
					await this.reconcileCanonicalType();
				} catch (error) {
					tasknotesLogger.error(
						"[TaskNotes][mdbase] Failed to reconcile the canonical task type.",
						{
							category: "configuration",
							operation: "canonical-type-reconcile",
							error,
						}
					);
				}
			}
		} finally {
			this.reconcilePromise = null;
			if (this.reconcileRequested) {
				this.requestReconciliation();
			}
		}
	}

	private async reconcileCanonicalType(): Promise<void> {
		if (!this.plugin.settings.enableMdbaseSpec) return;
		const collection = await this.readExistingCollection();
		if (!collection.exists) {
			await this.syncSettingsToCanonicalType(collection);
			if (await this.plugin.app.vault.adapter.exists("mdbase.yaml")) {
				this.publishNotice("TaskNotes restored the missing canonical mdbase.yaml file.");
			}
			return;
		}
		if (getSpecFamily(collection.config?.spec_version) !== "v0.3") return;
		const state = await this.readCanonicalType(collection);
		if (!state) {
			if (this.canonicalReadBlocked) return;
			const previousPath = this.canonicalTypePath;
			const wasMissing =
				previousPath !== null &&
				!(await this.plugin.app.vault.adapter.exists(previousPath));
			await this.syncSettingsToCanonicalType(collection);
			if (
				wasMissing &&
				previousPath &&
				(await this.plugin.app.vault.adapter.exists(previousPath))
			) {
				this.publishNotice(
					`TaskNotes restored the missing canonical type at ${previousPath}.`
				);
			}
			return;
		}
		if (state.content === this.lastKnownTypeContent) {
			this.canonicalTypePath = state.path;
			return;
		}

		const localChanged =
			this.lastAppliedSettingsFingerprint !== null &&
			portableSettingsFingerprint(this.plugin.settings) !==
				this.lastAppliedSettingsFingerprint;
		if (localChanged) {
			const choice = await this.askConflict(state.path, false);
			if (choice === "settings") {
				this.lastKnownTypeContent = state.content;
				await this.syncSettingsToCanonicalType(collection);
				return;
			}
		}

		this.applyCanonicalState(state);
		await this.plugin.saveSettingsDataOnly();
		await this.plugin.settingsLifecycleService?.onCanonicalSettingsChanged();
	}

	private askConflict(path: string, invalidType: boolean): Promise<ConflictChoice> {
		return new Promise((resolve) => {
			new MdbaseConfigurationConflictModal(
				this.plugin.app,
				path,
				invalidType,
				resolve
			).open();
		});
	}

	private reportInvalidCanonicalType(message: string, error?: unknown): void {
		tasknotesLogger.warn(`[TaskNotes][mdbase] ${message}`, {
			category: "configuration",
			operation: "canonical-type-invalid",
			...(error ? { error } : {}),
		});
		this.publishNotice(`${message} TaskNotes kept its last-known-good configuration.`);
	}

	private publishNotice(message: string): void {
		if (this.plugin.emitter) {
			publishUserNotice(this.plugin.emitter, message);
		} else {
			this.pendingUserNotices.push(message);
		}
	}

	private clearCanonicalState(): void {
		this.canonicalTypePath = null;
		this.canonicalTypesFolder = null;
		this.canonicalResourcePaths.clear();
		this.lastKnownTypeContent = null;
		this.lastAppliedSettingsFingerprint = null;
		this.canonicalReadBlocked = false;
	}

	private resolveTypesFolder(existingCollection: ExistingCollection): string {
		return (
			this.normalizeTypesFolder(existingCollection.config?.settings?.types_folder) ??
			this.canonicalTypesFolder ??
			DEFAULT_TYPES_FOLDER
		);
	}

	private resolveContractsFolder(existingCollection: ExistingCollection): string {
		return (
			this.normalizeTypesFolder(
				existingCollection.config?.settings?.contracts_folder
			) ?? DEFAULT_CONTRACTS_FOLDER
		);
	}

	private async writeMissingCollectionConfig(
		typesFolder: string,
		legacyCompatibility: boolean,
		state: CanonicalTypeState
	): Promise<void> {
		const typeName = typeof state.type.name === "string" ? state.type.name : "task";
		const resources = this.buildCanonicalMdbaseResources(
			typesFolder,
			legacyCompatibility,
			typeName,
			DEFAULT_CONTRACTS_FOLDER
		);
		await this.writeCanonicalSupportResources(resources);
		await this.writeFile("mdbase.yaml", resources.configDocument);
	}

	private async readExistingCollection(): Promise<ExistingCollection> {
		const vault = this.plugin.app.vault;
		const mdbaseExists = await vault.adapter.exists("mdbase.yaml");
		if (!mdbaseExists) {
			return { exists: false, config: null };
		}

		try {
			const content = await vault.adapter.read("mdbase.yaml");
			const parsed = YAML.parse(content) as unknown;
			if (!isRecord(parsed)) {
				return { exists: true, config: null };
			}
			return { exists: true, config: parsed };
		} catch (error) {
			tasknotesLogger.warn("[TaskNotes][mdbase-spec] Failed to read mdbase.yaml:", {
				category: "configuration",
				operation: "read-mdbase-yaml",
				error: error,
			});
			return { exists: true, config: null };
		}
	}

	private normalizeTypesFolder(value: unknown): string | null {
		if (typeof value !== "string") {
			return null;
		}

		const trimmed = value.trim();
		if (!trimmed || trimmed.startsWith("/") || trimmed === "." || trimmed === "..") {
			return null;
		}

		const normalized = normalizePath(trimmed);
		if (
			!normalized ||
			normalized === "." ||
			normalized === ".." ||
			normalized.startsWith("../") ||
			normalized.includes("/../")
		) {
			return null;
		}

		return normalized;
	}

	private async ensureFolderPath(folderPath: string): Promise<void> {
		const vault = this.plugin.app.vault;
		const parts = folderPath.split("/").filter(Boolean);
		let currentPath = "";

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const folderExists = await vault.adapter.exists(currentPath);
			if (!folderExists) {
				await vault.createFolder(currentPath);
			}
		}
	}

	private async writeFileIfUnchanged(
		snapshot: FileSnapshot,
		content: string
	): Promise<void> {
		const vault = this.plugin.app.vault;
		if (snapshot.content === null) {
			const parent = snapshot.path.split("/").slice(0, -1).join("/");
			if (parent) await this.ensureFolderPath(parent);
			await vault.create(snapshot.path, content);
			return;
		}
		const file = vault.getAbstractFileByPath?.(snapshot.path);
		if (file instanceof TFile) {
			await vault.process(file, (current) => {
				if (current !== snapshot.content) {
					throw new Error(`Refusing to overwrite a concurrent change to ${snapshot.path}`);
				}
				return content;
			});
			return;
		}
		if ((await vault.adapter.read(snapshot.path)) !== snapshot.content) {
			throw new Error(`Refusing to overwrite a concurrent change to ${snapshot.path}`);
		}
		await vault.adapter.write(snapshot.path, content);
	}

	/**
	 * Write a file, creating it if it doesn't exist or updating if it does.
	 */
	private async writeFile(path: string, content: string): Promise<void> {
		const vault = this.plugin.app.vault;
		const fileExists = await vault.adapter.exists(path);

		if (fileExists) {
			await vault.adapter.write(path, content);
		} else {
			await vault.create(path, content);
		}
	}

	private async writeCanonicalSupportResources(
		resources: TaskNotesMdbaseResources
	): Promise<void> {
		const entries = [
			[resources.paths.contract, resources.contractDocument],
			[resources.paths.taskSchema, resources.taskSchemaDocument],
			[resources.paths.bindingSchema, resources.bindingSchemaDocument],
		] as const;
		const previousWriteState = this.writeInProgress;
		this.writeInProgress = true;
		try {
			for (const [path, content] of entries) {
				const parent = path.split("/").slice(0, -1).join("/");
				if (parent) await this.ensureFolderPath(parent);
				await this.writeFile(path, content);
				this.canonicalResourcePaths.add(path);
			}
		} finally {
			this.writeInProgress = previousWriteState;
		}
	}

	/**
	 * Build the mdbase.yaml content.
	 */
	buildMdbaseYaml(typesFolder = DEFAULT_TYPES_FOLDER): string {
		const normalizedTypesFolder =
			this.normalizeTypesFolder(typesFolder) ?? DEFAULT_TYPES_FOLDER;
		return this.buildCanonicalMdbaseResources(normalizedTypesFolder, false).configDocument;
	}

	/**
	 * Build the _types/task.md content for a supported collection version.
	 */
	buildTaskTypeDef(
		specVersion = MDBASE_V03_SPEC_VERSION,
		options: TypeGenerationOptions = {}
	): string {
		const family = getSpecFamily(specVersion);
		if (family === "v0.2") {
			return this.buildTaskTypeDefV02();
		}
		if (family === "v0.3") {
			return this.buildTaskTypeDefV03(options.legacyCompatibility === true);
		}
		throw new Error(`Unsupported mdbase spec version: ${specVersion}`);
	}

	/**
	 * Build the legacy v0.2 task type. Retained only for existing collections.
	 */
	private buildTaskTypeDefV02(): string {
		const settings = this.plugin.settings;
		const fm = this.plugin.fieldMapper;

		const lines: string[] = [];
		lines.push("---");
		lines.push("name: task");
		lines.push("description: A task managed by the TaskNotes plugin for Obsidian.");
		lines.push(`display_name_key: ${fm.toUserField("title")}`);
		lines.push("strict: false");
		lines.push(`path_pattern: ${yamlQuote(this.buildPathPattern())}`);
		lines.push("");

		// Match section
		lines.push("match:");
		this.addMatchRules(lines);
		lines.push("");

		// Fields section
		lines.push("fields:");

		// Core fields
		this.addRoleField(lines, "title", {
			type: "string",
			required: true,
			description: "Short summary of the task.",
		});

		this.addRoleField(lines, "status", {
			type: "enum",
			required: true,
			values: settings.customStatuses.map((s) => s.value),
			default: settings.defaultTaskStatus,
			tn_completed_values: settings.customStatuses
				.filter((s) => s.isCompleted)
				.map((s) => s.value),
		});

		this.addRoleField(lines, "priority", {
			type: "enum",
			values: settings.customPriorities.map((p) => p.value),
			default: settings.defaultTaskPriority,
		});

		this.addRoleField(lines, "due", { type: "date" });
		this.addRoleField(lines, "scheduled", { type: "date" });
		this.addRoleField(lines, "contexts", {
			type: "list",
			items: { type: "string" },
		});
		this.addRoleField(lines, "projects", {
			type: "list",
			items: { type: "link" },
			description: "Wikilinks to related project notes.",
		});
		this.addRoleField(lines, "timeEstimate", {
			type: "integer",
			min: 0,
			description: "Estimated time in minutes.",
		});
		this.addRoleField(lines, "completedDate", { type: "date" });
		this.addRoleField(lines, "dateCreated", {
			type: "datetime",
			required: true,
			generated: "now",
		});
		this.addRoleField(lines, "dateModified", {
			type: "datetime",
			generated: "now_on_write",
		});
		this.addRoleField(lines, "recurrence", { type: "string" });
		this.addRoleField(lines, "recurrenceAnchor", {
			type: "enum",
			values: ["scheduled", "completion"],
			default: "scheduled",
		});
		this.addRoleField(lines, "occurrenceMaterialization", {
			type: "enum",
			values: ["manual", "on_completion", "rolling"],
			default: "manual",
			description: "How occurrence task notes are materialized for a recurring parent task.",
		});
		this.addRoleField(lines, "occurrenceNextTrigger", {
			type: "enum",
			values: ["completion", "completion_or_skip"],
			default: "completion",
			description: "Which occurrence state changes should materialize the next occurrence.",
		});
		this.addRoleField(lines, "occurrenceTemplate", {
			type: "link",
			description: "Optional template note used when materializing occurrences.",
		});
		this.addRoleField(lines, "occurrencePastHorizon", {
			type: "string",
			description: "ISO 8601 duration controlling rolling materialization before today.",
		});
		this.addRoleField(lines, "occurrenceFutureHorizon", {
			type: "string",
			description: "ISO 8601 duration controlling rolling materialization after today.",
		});
		this.addRoleField(lines, "recurrenceParent", {
			type: "link",
			description: "Parent recurring task for a materialized occurrence note.",
		});
		this.addRoleField(lines, "occurrenceDate", {
			type: "date",
			description: "Target recurrence date for a materialized occurrence note.",
		});
		this.addField(lines, "tags", { type: "list", items: { type: "string" }, tn_role: "tags" });

		// Complex nested fields
		this.addRoleField(lines, "timeEntries", {
			type: "list",
			items: {
				type: "object",
				fields: {
					startTime: { type: "datetime" },
					endTime: { type: "datetime" },
					description: { type: "string" },
					duration: { type: "integer" },
				},
			},
		});

		this.addRoleField(lines, "reminders", {
			type: "list",
			items: {
				type: "object",
				fields: {
					id: { type: "string", required: true },
					type: { type: "enum", values: ["absolute", "relative"] },
					description: { type: "string" },
					relatedTo: {
						type: "enum",
						values: ["due", "scheduled"],
						description: "Field the reminder is relative to (e.g. 'due').",
					},
					offset: {
						type: "string",
						description: "ISO 8601 duration offset (e.g. '-PT1H').",
					},
					absoluteTime: { type: "datetime" },
				},
			},
			description: "Reminder objects with id, type, offset, etc.",
		});

		this.addRoleField(lines, "blockedBy", {
			type: "list",
			items: {
				type: "object",
				fields: {
					uid: { type: "link", required: true },
					reltype: { type: "string" },
					gap: { type: "string" },
				},
			},
		});

		this.addRoleField(lines, "completeInstances", {
			type: "list",
			items: { type: "date" },
		});
		this.addRoleField(lines, "skippedInstances", {
			type: "list",
			items: { type: "date" },
		});
		this.addRoleField(lines, "icsEventId", {
			type: "list",
			items: { type: "string" },
		});
		this.addRoleField(lines, "googleCalendarEventId", { type: "string" });
		this.addRoleField(lines, "googleCalendarExceptionEventId", { type: "string" });
		this.addRoleField(lines, "googleCalendarExceptionOriginalScheduled", { type: "date" });
		this.addRoleField(lines, "googleCalendarMovedOriginalDates", {
			type: "list",
			items: { type: "date" },
		});

		// User-defined fields
		if (settings.userFields && settings.userFields.length > 0) {
			for (const uf of settings.userFields) {
				this.addField(lines, uf.key, this.mapUserFieldType(uf));
			}
		}

		// Portable TaskNotes extension settings. These are optional contract
		// fields, so older mdbase consumers can safely ignore them.
		lines.push("");
		lines.push("x-tasknotes:");
		lines.push("  nlp:");
		const nlpTriggers = settings.nlpTriggers?.triggers ?? [];
		if (nlpTriggers.length === 0) {
			lines.push("    triggers: []");
		} else {
			lines.push("    triggers:");
			for (const trigger of nlpTriggers) {
				lines.push(`      - property_id: ${yamlQuote(trigger.propertyId)}`);
				lines.push(`        trigger: ${yamlQuote(trigger.trigger)}`);
				lines.push(`        enabled: ${trigger.enabled === true}`);
			}
		}

		lines.push("---");
		lines.push("");
		lines.push("# Task");
		lines.push("");
		lines.push("This type definition describes the data schema for tasks managed by");
		lines.push("[TaskNotes](https://github.com/callumalpass/tasknotes), an Obsidian plugin");
		lines.push("for note-based task management.");
		lines.push("");
		lines.push(
			"It conforms to [mdbase-spec](https://github.com/callumalpass/mdbase-spec) v0.2.0,"
		);
		lines.push("a specification for typed markdown collections.");
		lines.push("");
		lines.push("TaskNotes also adds a non-standard `tn_role` field annotation on schema");
		lines.push("fields. This maps each field to its TaskNotes semantic role so custom");
		lines.push("frontmatter field names can still be interpreted consistently.");
		lines.push("The status field also includes `tn_completed_values`, listing");
		lines.push("which status values count as completed.");
		lines.push("");
		lines.push(
			"This file is automatically generated from TaskNotes settings and should not be"
		);
		lines.push("edited manually. Changes to TaskNotes settings (statuses, priorities, field");
		lines.push("mappings, user fields) will cause this file to be regenerated.");
		lines.push("");

		return lines.join("\n");
	}

	/**
	 * Delegate the v0.3 contract projection to @tasknotes/model. The plugin owns
	 * vault I/O and its legacy v0.2 writer; the package owns the portable v0.3
	 * config, data contract, schemas, lifecycle, and implementation binding.
	 */
	private buildTaskTypeDefV03(legacyCompatibility: boolean): string {
		return this.buildCanonicalMdbaseResources(DEFAULT_TYPES_FOLDER, legacyCompatibility)
			.typeDocument;
	}

	private buildCanonicalMdbaseResources(
		typesFolder: string,
		legacyCompatibility: boolean,
		typeName = "task",
		contractsFolder = DEFAULT_CONTRACTS_FOLDER
	): TaskNotesMdbaseResources {
		const settings = this.plugin.settings;
		const filenameFormat = settings.storeTitleInFilename
			? "title"
			: settings.taskFilenameFormat;
		const templatePath = settings.taskCreationDefaults?.bodyTemplate?.trim() ?? "";
		const occurrenceTemplatePath =
			settings.taskCreationDefaults?.occurrenceBodyTemplate?.trim() ?? "";

		return buildTaskNotesMdbaseResources({
			typeName,
			typesFolder,
			contractsFolder,
			tasksFolder: settings.tasksFolder || "",
			legacyCompatibility,
			modelConfig: buildTaskNotesModelConfig(settings),
			path: { template: this.getFilenameTemplate() },
			title: {
				filenameFormat,
				...(filenameFormat === "custom"
					? { customFilenameTemplate: settings.customFilenameTemplate }
					: {}),
			},
			links: {
				writeFormat: settings.useFrontmatterMarkdownLinks ? "markdown" : "wikilink",
			},
			archive: {
				moveOnArchive: settings.moveArchivedTasks === true,
				...(settings.archiveFolder?.trim()
					? { folder: settings.archiveFolder.trim() }
					: {}),
			},
			templating: {
				enabled:
					settings.taskCreationDefaults?.useBodyTemplate === true &&
					templatePath.length > 0,
				templatePath,
				occurrenceEnabled:
					settings.taskCreationDefaults?.useOccurrenceBodyTemplate === true &&
					occurrenceTemplatePath.length > 0,
				occurrenceTemplatePath,
			},
		});
	}

	/**
	 * Add a field definition to the YAML lines array using multi-line format.
	 */
	private addField(lines: string[], name: string, def: FieldDef, indent = 2): void {
		const pad = " ".repeat(indent);
		lines.push(`${pad}${name}:`);
		this.writeFieldProps(lines, def, indent + 2);
	}

	/**
	 * Add a role-annotated field. Resolves the user-facing field name via
	 * FieldMapper and automatically sets `tn_role` so that mtn can discover
	 * which role each field plays regardless of its actual name.
	 */
	private addRoleField(
		lines: string[],
		internalName: keyof FieldMapping,
		def: FieldDef,
		indent = 2
	): void {
		const fieldName = this.plugin.fieldMapper.toUserField(internalName);
		this.addField(lines, fieldName, { ...def, tn_role: internalName }, indent);
	}

	/**
	 * Write field properties as indented YAML lines.
	 */
	private writeFieldProps(lines: string[], def: FieldDef, indent: number): void {
		const pad = " ".repeat(indent);
		lines.push(`${pad}type: ${def.type}`);

		if (def.required) {
			lines.push(`${pad}required: true`);
		}
		if (def.generated) {
			lines.push(`${pad}generated: ${def.generated}`);
		}
		if (def.values) {
			lines.push(`${pad}values: [${def.values.map(yamlQuote).join(", ")}]`);
		}
		if (def.tn_completed_values && def.tn_completed_values.length > 0) {
			lines.push(
				`${pad}tn_completed_values: [${def.tn_completed_values.map(yamlQuote).join(", ")}]`
			);
		}
		if (def.default !== undefined) {
			lines.push(`${pad}default: ${yamlQuote(def.default)}`);
		}
		if (def.min !== undefined) {
			lines.push(`${pad}min: ${def.min}`);
		}
		if (def.description) {
			lines.push(`${pad}description: ${yamlQuote(def.description)}`);
		}
		if (def.tn_role) {
			lines.push(`${pad}tn_role: ${def.tn_role}`);
		}
		if (def.items) {
			if (def.items.type === "object" && def.items.fields) {
				lines.push(`${pad}items:`);
				lines.push(`${pad}  type: object`);
				lines.push(`${pad}  fields:`);
				for (const [fieldName, fieldDef] of Object.entries(def.items.fields)) {
					this.addField(lines, fieldName, fieldDef, indent + 4);
				}
			} else {
				lines.push(`${pad}items:`);
				lines.push(`${pad}  type: ${def.items.type}`);
			}
		}
	}

	/**
	 * Map a user-defined field type to an mdbase-spec field definition.
	 */
	private mapUserFieldType(uf: UserMappedField): FieldDef {
		switch (uf.type) {
			case "text":
				return { type: "string" };
			case "number":
				return { type: "number" };
			case "date":
				return { type: "date" };
			case "boolean":
				return { type: "boolean" };
			case "list":
				return { type: "list", items: { type: "string" } };
			default:
				return { type: "string" };
		}
	}

	/**
	 * Add match rules based on task identification settings.
	 * Matching should be based on tag or frontmatter key/value, not folder location.
	 */
	private addMatchRules(lines: string[]): void {
		const settings = this.plugin.settings;

		if (settings.taskIdentificationMethod === "property") {
			const propertyName = settings.taskPropertyName?.trim();
			const propertyValue = settings.taskPropertyValue?.trim();

			// Fall back to tag matching when property mode is enabled without a key.
			if (!propertyName) {
				this.addTagMatchRule(lines);
				return;
			}

			lines.push("  where:");
			lines.push(`    ${yamlKey(propertyName)}:`);

			if (propertyValue) {
				lines.push(`      eq: ${yamlScalar(propertyValue)}`);
			} else {
				lines.push("      exists: true");
			}

			return;
		}

		this.addTagMatchRule(lines);
	}

	/**
	 * Match tasks by configured task tag.
	 */
	private addTagMatchRule(lines: string[]): void {
		const taskTag = this.plugin.settings.taskTag?.trim() || "task";
		lines.push("  where:");
		lines.push("    tags:");
		lines.push(`      contains: ${yamlQuote(taskTag)}`);
	}

	/**
	 * Build a best-effort mdbase path_pattern from TaskNotes folder + filename settings.
	 * TaskNotes supports richer templating than mdbase, so unknown variables are kept
	 * as placeholders and resolved by compatible clients when possible.
	 */
	private buildPathPattern(): string {
		const folderTemplate = this.toMdbaseTemplate(this.plugin.settings.tasksFolder || "");
		const filenameTemplate = this.getFilenameTemplate();
		const filenamePatternRaw =
			this.toMdbaseTemplate(filenameTemplate) ||
			`{${this.plugin.fieldMapper.toUserField("title")}}`;
		const filenamePattern = filenamePatternRaw.endsWith(".md")
			? filenamePatternRaw
			: `${filenamePatternRaw}.md`;

		if (!folderTemplate) {
			return filenamePattern;
		}
		return `${folderTemplate}/${filenamePattern}`;
	}

	private getFilenameTemplate(): string {
		const settings = this.plugin.settings;
		if (settings.storeTitleInFilename || settings.taskFilenameFormat === "title") {
			return "{{title}}";
		}

		switch (settings.taskFilenameFormat) {
			case "timestamp":
				return "{{timestamp}}";
			case "uuid":
				return "{{uuid}}";
			case "custom":
				return settings.customFilenameTemplate?.trim() || "{{title}}";
			case "zettel":
			default:
				return "{{zettel}}";
		}
	}

	private toMdbaseTemplate(template: string): string {
		const raw = (template || "").trim();
		if (!raw) return "";

		const variableMap = this.getPathVariableMap();
		const converted = raw.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (_match, a, b) => {
			const key = String(a ?? b);
			const mapped = variableMap[key] || key;
			return `{${mapped}}`;
		});

		return converted
			.replace(/\\/g, "/")
			.replace(/\/+/g, "/")
			.replace(/^\/+|\/+$/g, "");
	}

	private getPathVariableMap(): Record<string, string> {
		const fm = this.plugin.fieldMapper;
		return {
			title: fm.toUserField("title"),
			priority: fm.toUserField("priority"),
			status: fm.toUserField("status"),
			dueDate: fm.toUserField("due"),
			scheduledDate: fm.toUserField("scheduled"),
			due: fm.toUserField("due"),
			scheduled: fm.toUserField("scheduled"),
		};
	}
}

function getSpecFamily(specVersion: unknown): SupportedSpecFamily | null {
	if (typeof specVersion !== "string") {
		return null;
	}
	if (/^0\.2\.\d+(?:[-+].*)?$/.test(specVersion)) {
		return "v0.2";
	}
	if (/^0\.3\.\d+(?:[-+].*)?$/.test(specVersion)) {
		return "v0.3";
	}
	return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringValues(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (!Array.isArray(value)) return [];
	return value.filter((entry): entry is string => typeof entry === "string");
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values.filter((value) => value.length > 0))];
}

function isUnmodifiedGeneratedV02Type(content: string, expected: string): boolean {
	return content.replace(/\r\n/g, "\n") === expected.replace(/\r\n/g, "\n");
}

function parseMigrationJournal(value: unknown): MigrationJournal {
	if (!isRecord(value) || typeof value.backupFolder !== "string") {
		throw new Error("The pending migration record is malformed.");
	}
	if (
		!value.backupFolder.startsWith(`${MDBASE_MIGRATION_BACKUP_FOLDER}/`) ||
		!isSafeVaultPath(value.backupFolder)
	) {
		throw new Error("The pending migration backup path is unsafe.");
	}
	const parseEntries = (entries: unknown, label: string): FileSnapshot[] => {
		if (!Array.isArray(entries)) throw new Error(`The pending migration ${label} are malformed.`);
		return entries.map((entry) => {
			if (
				!isRecord(entry) ||
				typeof entry.path !== "string" ||
				!isSafeVaultPath(entry.path) ||
				(entry.content !== null && typeof entry.content !== "string")
			) {
				throw new Error(`The pending migration ${label} contain an unsafe entry.`);
			}
			return { path: entry.path, content: entry.content };
		});
	};
	const snapshots = parseEntries(value.snapshots, "snapshots");
	const intendedWrites = parseEntries(value.intendedWrites, "writes");
	const snapshotPaths = snapshots.map(({ path }) => path);
	const intendedPaths = intendedWrites.map(({ path }) => path);
	if (
		new Set(snapshotPaths).size !== snapshotPaths.length ||
		new Set(intendedPaths).size !== intendedPaths.length ||
		snapshotPaths.length !== intendedPaths.length ||
		snapshotPaths.some((path) => !intendedPaths.includes(path)) ||
		!snapshotPaths.includes("mdbase.yaml") ||
		snapshotPaths.includes(MDBASE_MIGRATION_PENDING_PATH)
	) {
		throw new Error("The pending migration file set is invalid.");
	}
	const sourceConfig = parseJournalConfig(
		snapshots.find(({ path }) => path === "mdbase.yaml")?.content
	);
	const migratedConfig = parseJournalConfig(
		intendedWrites.find(({ path }) => path === "mdbase.yaml")?.content
	);
	const typesFolder = normalizeJournalFolder(sourceConfig.settings?.types_folder) ??
		DEFAULT_TYPES_FOLDER;
	const contractsFolder = normalizeJournalFolder(migratedConfig.settings?.contracts_folder) ??
		DEFAULT_CONTRACTS_FOLDER;
	const expectedPaths = new Set([
		"mdbase.yaml",
		`${typesFolder}/task.md`,
		`${contractsFolder}/tasknotes.task.md`,
		"_schemas/tasknotes/tasknotes-task.schema.json",
		"_schemas/tasknotes/tasknotes-task-binding.schema.json",
	]);
	if (
		snapshotPaths.length !== expectedPaths.size ||
		snapshotPaths.some((path) => !expectedPaths.has(path))
	) {
		throw new Error("The pending migration includes files outside TaskNotes metadata.");
	}
	return { backupFolder: value.backupFolder, snapshots, intendedWrites };
}

function parseJournalConfig(content: string | null | undefined): MdbaseYamlConfig {
	if (typeof content !== "string") throw new Error("The pending migration config is missing.");
	const parsed = YAML.parse(content) as unknown;
	if (!isRecord(parsed)) throw new Error("The pending migration config is malformed.");
	return parsed;
}

function normalizeJournalFolder(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!isSafeVaultPath(trimmed)) return null;
	const normalized = normalizePath(trimmed);
	return isSafeVaultPath(normalized) ? normalized : null;
}

function isSafeVaultPath(path: string): boolean {
	return (
		path.length > 0 &&
		!path.startsWith("/") &&
		path !== "." &&
		path !== ".." &&
		!path.startsWith("../") &&
		!path.includes("/../")
	);
}

function hasTaskNotesImplementation(type: Record<string, unknown>): boolean {
	return (
		Array.isArray(type.implements) &&
		type.implements.some(
			(implementation) =>
				isRecord(implementation) &&
				implementation.contract === "tasknotes.task" &&
				implementation.version === TASKNOTES_CONTRACT_VERSION
		)
	);
}

/**
 * Internal type for field definitions used during YAML generation.
 */
interface FieldDef {
	type: string;
	required?: boolean;
	generated?: string;
	values?: string[];
	tn_completed_values?: string[];
	default?: string;
	min?: number;
	description?: string;
	tn_role?: string;
	items?: {
		type: string;
		fields?: Record<string, FieldDef>;
	};
}

/**
 * Quote a string value for YAML output. Always double-quotes to handle
 * special characters safely.
 */
function yamlQuote(value: string): string {
	const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	return `"${escaped}"`;
}

/**
 * Quote a YAML key to safely handle special characters.
 */
function yamlKey(value: string): string {
	return yamlQuote(value);
}

/**
 * Format scalar values for YAML, coercing boolean-like strings to booleans.
 */
function yamlScalar(value: string): string {
	const lower = value.toLowerCase();
	if (lower === "true" || lower === "false") {
		return lower;
	}
	return yamlQuote(value);
}
