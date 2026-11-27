import type { EventRef, TAbstractFile, Vault } from "obsidian";
import { readCollectionTimeZone } from "./mdbase/collectionConfig";
import { namedTimeZone, setVaultTimeZone } from "../utils/vaultTime";

const CONFIG_PATH = "mdbase.yaml";

/** Observes the collection independently of TaskNotes' opt-in type management. */
export class VaultTimeZoneService {
	collectionTimeZone: string | undefined;
	private revision = 0;
	private disposed = false;

	constructor(
		private readonly vault: Vault,
		private readonly getFallback: () => string,
		private readonly onChange: () => void,
	) {}

	async initialize(register: (ref: EventRef) => void): Promise<void> {
		const onFileChange = (file: TAbstractFile, oldPath?: string) => {
			if (file.path === CONFIG_PATH || oldPath === CONFIG_PATH) void this.refresh();
		};
		register(this.vault.on("create", onFileChange));
		register(this.vault.on("modify", onFileChange));
		register(this.vault.on("delete", onFileChange));
		register(this.vault.on("rename", onFileChange));
		await this.refresh();
	}

	async refresh(): Promise<void> {
		const revision = ++this.revision;
		const zone = await readCollectionTimeZone(this.vault.adapter);
		if (this.disposed || revision !== this.revision) return;
		this.collectionTimeZone = zone;
		this.applySettings();
	}

	applySettings(): void {
		if (this.disposed) return;
		const zone = this.collectionTimeZone ?? namedTimeZone(this.getFallback());
		if (setVaultTimeZone(zone)) this.onChange();
	}

	dispose(): void {
		this.disposed = true;
		setVaultTimeZone(undefined);
	}
}
