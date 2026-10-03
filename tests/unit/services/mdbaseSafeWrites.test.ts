import * as fs from "node:fs/promises";
import * as path from "node:path";
import YAML from "yaml";
import { TFile } from "obsidian";
import { MdbaseSpecService } from "../../../src/services/MdbaseSpecService";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { SafeMetadata } from "../../../src/services/mdbase/SafeMetadata";
import { METADATA_PENDING } from "../../../src/services/mdbase/MetadataTransaction";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { parseMdbaseTaskTypeDocument } from "../../../src/services/mdbaseCanonicalConfig";

const fixture = (name: string): Record<string, string> => require(`../../fixtures/mdbase-upgrades/${name}.json`).files;
const type = (document: string) => parseMdbaseTaskTypeDocument(document).type as any;
const faultFixture = (target: string) => {
	const before = { ...fixture("beta0-custom") };
	if (target === "mdbase.yaml") {
		const config = YAML.parse(before[target]);
		delete config.settings.explicit_type_keys;
		before[target] = YAML.stringify(config);
	}
	return before;
};

export function safetyHarness(entries: Record<string, string>) {
	const files = new Map(Object.entries(entries));
	const folders = new Set<string>();
	const parents = (p: string) => {
		let current = "";
		for (const part of p.split("/").slice(0, -1)) {
			current = current ? `${current}/${part}` : part;
			folders.add(current);
		}
	};
	for (const p of files.keys()) parents(p);
	const hooks: { write?: (p: string, c: string) => Promise<void>; rename?: (from: string, to: string) => Promise<void>; create?: (p: string) => Promise<void> } = {};
	const adapter = {
		exists: async (p: string) => files.has(p) || folders.has(p),
		read: async (p: string) => { if (!files.has(p)) throw new Error(`Missing file: ${p}`); return files.get(p)!; },
		write: async (p: string, c: string) => { await hooks.write?.(p, c); files.set(p, c); parents(p); },
		rename: async (from: string, to: string) => { await hooks.rename?.(from, to); const c = files.get(from); if (c === undefined) throw new Error(`Missing file: ${from}`); files.set(to, c); files.delete(from); parents(to); },
		remove: async (p: string) => { files.delete(p); },
		list: async (folder: string) => { const prefix = folder ? `${folder}/` : ""; const direct = (p: string) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"); return { files: [...files.keys()].filter(direct), folders: [...folders].filter((p) => p !== folder && direct(p)) }; },
	};
	const notices: string[] = [];
	const plugin: any = {
		settings: { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), enableMdbaseSpec: true },
		// Exactly the bootstrap state: no FieldMapper/runtime services yet.
		app: { vault: {
			adapter,
			getAbstractFileByPath: (p: string) => files.has(p) ? new (TFile as any)(p) : null,
			process: async (file: { path: string }, update: (c: string) => string) => { const c = update(files.get(file.path)!); files.set(file.path, c); return c; },
			create: async (p: string, c: string) => { await hooks.create?.(p); if (files.has(p)) throw new Error(`Exists: ${p}`); files.set(p, c); parents(p); return { path: p }; },
			createFolder: async (p: string) => { folders.add(p); parents(`${p}/child`); },
			on: () => ({}),
		} },
		registerEvent: () => {},
		emitter: { trigger: (_event: string, payload: any) => notices.push(String(payload?.message ?? payload)) },
	};
	const service = new MdbaseSpecService(plugin);
	return { files, hooks, plugin, service, notices, adapter };
}

function unchangedRecords(before: Record<string, string>, files: Map<string, string>) {
	for (const p of ["TaskNotes/Tasks/open.md", "TaskNotes/Tasks/cancelled.md", "paper.md"]) expect(files.get(p)).toBe(before[p]);
}

describe("safe migration writes and recovery", () => {
	it("uses the real bootstrap order, migrating beta metadata before FieldMapper construction", async () => {
		const h = safetyHarness(fixture("beta0-custom"));
		delete h.plugin.emitter;
		jest.doMock("../../../src/api/TaskNotesAPI", () => ({ TaskNotesAPI: jest.fn() }));
		let mapperConstructions = 0;
		jest.doMock("../../../src/services/FieldMapper", () => ({ FieldMapper: jest.fn((mapping) => {
			if (++mapperConstructions === 1) {
				expect(h.plugin.fieldMapper).toBeUndefined();
				return new FieldMapper(mapping);
			}
			expect(h.plugin.fieldMapper).toBeDefined();
			expect(type(h.files.get("_types/task.md")!).implements[0].version).toBe("0.3.0-rc.5");
			expect(h.files.has(METADATA_PENDING)).toBe(false);
			throw new Error("runtime boundary reached");
		}) }));
		try {
			await jest.isolateModulesAsync(async () => {
				const { initializeCoreServices } = await import("../../../src/bootstrap/pluginBootstrap");
				await expect(initializeCoreServices(h.plugin)).rejects.toThrow("runtime boundary reached");
			});
		} finally {
			jest.dontMock("../../../src/api/TaskNotesAPI");
			jest.dontMock("../../../src/services/FieldMapper");
		}
	});

	it("refuses an external edit during staging and verifies every atomic replacement", async () => {
		const h = safetyHarness({ "mdbase.yaml": "old" });
		const io = new SafeMetadata(h.adapter as any);
		h.hooks.write = async () => { h.files.set("mdbase.yaml", "external"); };
		await expect(io.replace({ path: "mdbase.yaml", content: "old" }, "new")).rejects.toThrow("Concurrent");
		expect(h.files.get("mdbase.yaml")).toBe("external");
		expect([...h.files.keys()]).toEqual(["mdbase.yaml"]);
	});
	it.each(["_types/task.md", "_schemas/tasknotes/tasknotes-task.schema.json", "_contracts/tasknotes.task.md", "mdbase.yaml"])("rolls back a beta upgrade when %s fails", async (target) => {
		const before = faultFixture(target);
		const h = safetyHarness(before);
		let failed = false;
		h.hooks.rename = async (_from, to) => { if (to === target && !failed) { failed = true; throw new Error(`EACCES ${target}`); } };
		// Old code writes the indexed type through process; inject that boundary too.
		const process = h.plugin.app.vault.process;
		h.plugin.app.vault.process = async (file: { path: string }, update: any) => { if (file.path === target && !failed) { failed = true; throw new Error(`EACCES ${target}`); } return process(file, update); };
		await h.service.initialize();
		expect(failed).toBe(true);
		for (const [p, content] of Object.entries(before)) expect(h.files.get(p)).toBe(content);
		expect(h.files.has(METADATA_PENDING)).toBe(false);
		expect(h.notices.join(" ")).toContain("Backups");
		expect(h.notices.some((notice) => notice.startsWith("TaskNotes updated"))).toBe(false);
		unchangedRecords(before, h.files);
		await new MdbaseSpecService(h.plugin).initialize();
		expect(type(h.files.get("_types/task.md")!).implements[0].version).toBe("0.3.0-rc.5");
	});

	it.each(["_types/task.md", "mdbase.yaml", METADATA_PENDING])("a torn temp write for %s never corrupts the active file", async (target) => {
		const before = faultFixture(target);
		const h = safetyHarness(before);
		let fired = false;
		h.hooks.write = async (p, content) => {
			if (!fired && (p === target || p.startsWith(`${target}.tasknotes-stage-`))) {
				fired = true; h.files.set(p, content.slice(0, Math.floor(content.length / 2))); throw new Error(`ENOSPC ${target}`);
			}
		};
		await h.service.initialize();
		expect(fired).toBe(true);
		for (const [p, content] of Object.entries(before)) expect(h.files.get(p)).toBe(content);
		expect([...h.files.keys()].some((p) => p.includes(".tasknotes-stage-"))).toBe(false);
		await new MdbaseSpecService(h.plugin).initialize();
		expect(type(h.files.get("_types/task.md")!).implements[0].version).toBe("0.3.0-rc.5");
		unchangedRecords(before, h.files);
	});

	it.each(["_types/task.md", "mdbase.yaml", ".tasknotes/migrations/mdbase-v0.2-pending.json"])("v0.2 torn writes to %s are isolated and retryable", async (target) => {
		const before = fixture("v4-default");
		const h = safetyHarness(before);
		h.plugin.fieldMapper = new FieldMapper(h.plugin.settings.fieldMapping);
		let fired = false;
		const tear = (p: string, c: string) => {
			if (!fired && (p === target || p.startsWith(`${target}.tasknotes-stage-`))) {
				fired = true; h.files.set(p, c.slice(0, Math.floor(c.length / 2))); throw new Error("ENOSPC");
			}
		};
		h.hooks.write = async (p, c) => { tear(p, c); };
		h.hooks.create = async (p) => { if (p === target) tear(p, "partial journal"); };
		const process = h.plugin.app.vault.process;
		h.plugin.app.vault.process = async (file: { path: string }, update: any) => { if (file.path === target) tear(file.path, update(h.files.get(file.path))); return process(file, update); };
		await h.service.initialize();
		expect(fired).toBe(true);
		for (const [p, c] of Object.entries(before)) expect(h.files.get(p)).toBe(c);
		expect(h.files.has(".tasknotes/migrations/mdbase-v0.2-pending.json")).toBe(false);
		await new MdbaseSpecService(h.plugin).initialize();
		expect(YAML.parse(h.files.get("mdbase.yaml")!).spec_version).toBe("0.3.0");
		unchangedRecords(before, h.files);
	});

	it("restart identifies pending journal, backups and the externally changed file without overwriting it", async () => {
		const h = safetyHarness(fixture("beta0-custom"));
		let fired = false;
		h.hooks.rename = async (_from, to) => {
			if (!fired && to === "_contracts/tasknotes.task.md") {
				fired = true;
				h.files.set("_types/task.md", h.files.get("_types/task.md")! + "\nEXTERNAL CHANGE\n");
				throw new Error("Injected contract failure");
			}
		};
		await h.service.initialize();
		expect(h.files.has(METADATA_PENDING)).toBe(true);
		const changed = h.files.get("_types/task.md");
		const journal = JSON.parse(h.files.get(METADATA_PENDING)!);
		h.notices.length = 0;
		await new MdbaseSpecService(h.plugin).initialize();
		expect(h.files.get("_types/task.md")).toBe(changed);
		expect(h.notices.join(" ")).toContain(METADATA_PENDING);
		expect(h.notices.join(" ")).toContain(journal.backupFolder);
		expect(h.notices.join(" ")).toContain("_types/task.md");
		// User resolves the external edit explicitly; restart can now roll back then upgrade.
		h.files.set("_types/task.md", journal.intendedWrites.find((entry: any) => entry.path === "_types/task.md").content);
		await new MdbaseSpecService(h.plugin).initialize();
		expect(h.files.has(METADATA_PENDING)).toBe(false);
	});

	it("moves the actual duplicate revision without losing a concurrent edit", async () => {
		const before = fixture("beta3-app-then-beta3-custom");
		const h = safetyHarness(before);
		const source = "_types/tasknotes-task.md";
		const marker = "CONCURRENT SYNC USER CHANGE";
		let fired = false;
		const inject = () => { fired = true; h.files.set(source, h.files.get(source)! + `\n${marker}\n`); };
		h.hooks.create = async (p) => { if (p.includes("superseded-types-") && p.endsWith("/tasknotes-task.md")) inject(); };
		h.hooks.rename = async (from) => { if (from === source) inject(); };
		await h.service.initialize();
		expect(fired).toBe(true);
		expect([...h.files.values()].some((content) => content.includes(marker))).toBe(true);
		expect(h.notices.join(" ")).toMatch(/Concurrent|conflict/);
		expect(h.files.get("_contracts/tasknotes.task.md")).toBe(before["_contracts/tasknotes.task.md"]);
		unchangedRecords(before, h.files);
	});

	it.each(["mdbase_type", "kind", "types", "type"])("retains a duplicate explicitly referenced through %s", async (key) => {
		const before = fixture("beta3-app-then-beta3-custom");
		const h = safetyHarness(before);
		const config = YAML.parse(before["mdbase.yaml"]);
		if (key === "type" || key === "types") delete config.settings.explicit_type_keys;
		else config.settings.explicit_type_keys = [key];
		h.files.set("mdbase.yaml", YAML.stringify(config));
		const record = `---\n${key}: ${key === "types" ? "[tasknotes-task]" : "tasknotes-task"}\n---\n`;
		h.files.set("explicit.md", record);
		await h.service.initialize();
		expect(h.files.get("_types/tasknotes-task.md")).toBe(before["_types/tasknotes-task.md"]);
		expect(h.files.get("explicit.md")).toBe(record);
		expect(h.notices.join(" ")).toContain("explicit.md");
		expect(h.notices.join(" ")).toContain("_types/tasknotes-task.md");
	});

	it("does not discard a duplicate when membership keys are malformed", async () => {
		const h = safetyHarness(fixture("beta3-app-then-beta3-custom"));
		const config = YAML.parse(h.files.get("mdbase.yaml")!);
		config.settings.explicit_type_keys = "kind";
		h.files.set("mdbase.yaml", YAML.stringify(config));
		await h.service.initialize();
		expect(h.files.has("_types/tasknotes-task.md")).toBe(true);
		expect(h.notices.join(" ")).toContain("explicit_type_keys");
	});

	it("does not reuse an incomplete backup folder at the same timestamp", async () => {
		const h = safetyHarness(fixture("beta0-custom"));
		const folder = ".tasknotes/migrations/mdbase-v0.3-2026-10-02T12-00-00-000Z";
		const orphan = `${folder}/mdbase.yaml.bak`;
		await h.plugin.app.vault.createFolder(folder);
		await h.plugin.app.vault.create(orphan, "RECOVERY COPY FROM EARLIER FAILURE");
		const iso = jest.spyOn(Date.prototype, "toISOString").mockReturnValue("2026-10-02T12:00:00.000Z");
		try {
			await h.service.initialize();
			expect(h.files.get(orphan)).toBe("RECOVERY COPY FROM EARLIER FAILURE");
			expect(type(h.files.get("_types/task.md")!).implements[0].version).toBe("0.3.0-rc.5");
			expect(h.files.has(`${folder}-2/manifest.json`)).toBe(true);
		} finally { iso.mockRestore(); }
	});

	it("nested duplicates keep their relative paths and timestamp collisions never overwrite backups", async () => {
		const h = safetyHarness(fixture("beta3-app-then-beta3-custom"));
		const original = h.files.get("_types/tasknotes-task.md")!;
		h.files.delete("_types/tasknotes-task.md");
		await h.plugin.app.vault.create("_types/a/tasknotes-task.md", original);
		await h.plugin.app.vault.create("_types/b/tasknotes-task.md", original);
		const iso = jest.spyOn(Date.prototype, "toISOString").mockReturnValue("2026-10-02T12:00:00.000Z");
		try {
			await h.service.initialize();
			await h.plugin.app.vault.create("_types/a/tasknotes-task.md", original);
			await h.plugin.app.vault.create("_types/b/tasknotes-task.md", original);
			await new MdbaseSpecService(h.plugin).initialize();
			const backups = [...h.files.keys()].filter((p) => p.includes("superseded-types-") && p.endsWith("tasknotes-task.md"));
			expect(backups).toHaveLength(4);
			expect(backups.filter((p) => p.includes("/_types/a/"))).toHaveLength(2);
			expect(backups.filter((p) => p.includes("/_types/b/"))).toHaveLength(2);
		} finally { iso.mockRestore(); }
	});

	it("reports the tester's captured multiple-provider collection without modifying any file", async () => {
		const root = path.join(__dirname, "../../fixtures/mdbase-upgrades/safewrite-multiple-providers");
		const entries: Record<string, string> = {};
		const walk = async (folder: string) => {
			for (const entry of await fs.readdir(path.join(root, folder), { withFileTypes: true })) {
				const relative = path.posix.join(folder, entry.name);
				if (entry.isDirectory()) await walk(relative);
				else if (entry.name !== "README.md") entries[relative] = await fs.readFile(path.join(root, relative), "utf8");
			}
		};
		await walk("");
		const h = safetyHarness(entries);
		await h.service.initialize(); await h.service.initialize();
		expect(Object.fromEntries(h.files)).toEqual(entries);
		expect(h.notices).toHaveLength(1);
		expect(h.notices[0]).toContain("_types/task.md");
		expect(h.notices[0]).toContain("_types/second.md");
	});

	it.each(["beta0-custom", "app-rc17-default"])("startup lists multiple %s providers and deduplicates unchanged notices", async (name) => {
		const h = safetyHarness(fixture(name));
		const second = type(h.files.get("_types/task.md")!);
		second.name = "second-task";
		await h.plugin.app.vault.create("_types/second.md", `---\n${YAML.stringify(second)}---\n`);
		await h.service.initialize();
		await h.service.initialize();
		expect(h.notices).toHaveLength(1);
		expect(h.notices[0]).toContain("_types/task.md");
		expect(h.notices[0]).toContain("_types/second.md");
		expect(h.notices[0]).toContain("reload");
	});

	it("refuses symlinked metadata directories before modifying external targets", async () => {
		const scratch = await fs.mkdtemp(path.join(process.env.TMPDIR!, "safewrite-symlink-"));
		const previousRequire = window.require;
		window.require = require;
		try {
			const root = path.join(scratch, "vault");
			const target = path.join(scratch, "outside");
			await fs.mkdir(root); await fs.mkdir(target);
			const content = "external type bytes";
			await fs.writeFile(path.join(target, "task.md"), content);
			await fs.symlink(target, path.join(root, "_types"));
			const h = safetyHarness(fixture("beta0-custom"));
			Object.assign(h.adapter, { getBasePath: () => root });
			await h.service.initialize();
			expect(h.notices.join(" ")).toContain("Symlinked");
			expect(h.notices.join(" ")).toContain("physical directory");
			expect(await fs.readFile(path.join(target, "task.md"), "utf8")).toBe(content);
		} finally { window.require = previousRequire; await fs.rm(scratch, { recursive: true, force: true }); }
	});

	it("serializes cleanup and settings updates on the same metadata queue", async () => {
		const h = safetyHarness(fixture("beta3-app-then-beta3-custom"));
		let release!: () => void;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		let entered!: () => void;
		const entry = new Promise<void>((resolve) => { entered = resolve; });
		h.hooks.rename = async (from) => { if (from === "_types/tasknotes-task.md") { entered(); await gate; } };
		const initialization = h.service.initialize();
		await entry;
		const sync = jest.spyOn(h.service as any, "syncSettingsToCanonicalTypeSnapshot");
		const save = h.service.onSettingsChanged();
		await Promise.resolve(); await Promise.resolve();
		expect(sync).not.toHaveBeenCalled();
		release();
		await initialization; await save;
		expect(sync).toHaveBeenCalledTimes(1);
	});

	it("refuses safe cleanup when no adapter rename is available", async () => {
		const h = safetyHarness(fixture("beta3-app-then-beta3-custom"));
		(h.adapter as any).rename = undefined;
		await h.service.initialize();
		expect(h.files.has("_types/tasknotes-task.md")).toBe(true);
		expect(h.notices.join(" ")).toContain("move unavailable");
	});
});
