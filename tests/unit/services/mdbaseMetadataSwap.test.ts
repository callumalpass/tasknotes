import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Platform, TFile } from "obsidian";
import YAML from "yaml";
import { SafeMetadata } from "../../../src/services/mdbase/SafeMetadata";
import { METADATA_SWAPS, type SwapJournal } from "../../../src/services/mdbase/MetadataSwap";
import { MdbaseSpecService } from "../../../src/services/MdbaseSpecService";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { parseMdbaseTaskTypeDocument } from "../../../src/services/mdbaseCanonicalConfig";

function harness(entries: Record<string, string>) {
	const files = new Map(Object.entries(entries));
	const folders = new Set<string>();
	const parents = (p: string) => {
		const parts = p.split("/");
		for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join("/"));
	};
	for (const p of files.keys()) parents(p);
	const hooks: { move?: (from: string, to: string) => Promise<void>; afterMove?: (from: string, to: string) => Promise<void> } = {};
	const adapter = {
		exists: async (p: string) => files.has(p) || folders.has(p),
		read: async (p: string) => { if (!files.has(p)) throw new Error(`Missing: ${p}`); return files.get(p)!; },
		write: async (p: string, c: string) => { files.set(p, c); parents(p); },
		// Faithful non-desktop adapter: destination rejection happens AFTER the
		// fault/sync boundary. Never silently overwrite an occupied destination.
		rename: async (from: string, to: string) => {
			await hooks.move?.(from, to);
			if (files.has(to) || folders.has(to)) throw new Error(`Destination file already exists: ${to}`);
			if (!files.has(from)) throw new Error(`Missing: ${from}`);
			files.set(to, files.get(from)!); files.delete(from); parents(to);
			await hooks.afterMove?.(from, to);
		},
		remove: async (p: string) => { files.delete(p); },
		mkdir: async (p: string) => { folders.add(p); parents(`${p}/child`); },
		list: async (p: string) => ({ files: [...files.keys()].filter((f) => path.posix.dirname(f) === p), folders: [...folders].filter((f) => path.posix.dirname(f) === p) }),
	};
	const notices: string[] = [];
	const plugin: any = {
		settings: { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), enableMdbaseSpec: true },
		app: { vault: { adapter, createFolder: adapter.mkdir, on: () => ({}), getAbstractFileByPath: (p: string) => files.has(p) ? new (TFile as any)(p) : null } },
		registerEvent: () => {},
		emitter: { trigger: (_event: string, payload: any) => notices.push(String(payload?.message ?? payload)) },
	};
	return { adapter, hooks, files, plugin, notices, io: new SafeMetadata(adapter) };
}
const fixture = (name: string): Record<string, string> => require(`../../fixtures/mdbase-upgrades/${name}.json`).files;
const targets = ["_types/task.md", "mdbase.yaml", "_contracts/tasknotes.task.md"];

it.each(["v4-custom", "beta3-custom"])("upgrades %s on a no-clobber adapter in cold bootstrap state", async (name) => {
	const before = fixture(name);
	const h = harness(before);
	if (name === "v4-custom") {
		h.plugin.settings.fieldMapping.due = "deadline";
		h.plugin.settings.userFields = [{ id: "effort", displayName: "Effort", key: "effort", type: "number" }];
		h.plugin.settings.taskFilenameFormat = "zettel";
		h.plugin.settings.storeTitleInFilename = false;
		h.plugin.settings.customStatuses = ["none", "open", "in-progress", "done", "cancelled"].map((value, order) => ({
			id: value, value, label: value, color: "#808080", order, isCompleted: value === "done",
			autoArchive: false, autoArchiveDelay: 5, ...(value === "cancelled" ? { isSkipped: true, excludeFromCycle: true } : {}),
		}));
	}
	expect(h.plugin.fieldMapper).toBeUndefined();
	await new MdbaseSpecService(h.plugin).initialize();
	expect(YAML.parse(h.files.get("mdbase.yaml")!).spec_version).toBe("0.3.0");
	expect((parseMdbaseTaskTypeDocument(h.files.get("_types/task.md")!).type as any).implements[0].version).toBe("0.3.0-rc.5");
	for (const p of ["paper.md", "TaskNotes/Tasks/open.md", "TaskNotes/Tasks/cancelled.md"]) expect(h.files.get(p)).toBe(before[p]);
	const after = Object.fromEntries(h.files);
	await new MdbaseSpecService(h.plugin).initialize();
	expect(Object.fromEntries(h.files)).toEqual(after);
});

it.each(targets)("preserves the actual concurrent %s revision at displacement and publishes conflict, not success", async (target) => {
	const h = harness(fixture("beta3-custom"));
	let fired = false;
	const marker = "CONCURRENT EDIT AT ACTUAL REVISION MOVE";
	h.hooks.move = async (from, to) => {
		if (!fired && from === target && to.startsWith(METADATA_SWAPS)) {
			fired = true; h.files.set(target, h.files.get(target)! + `\n<!-- ${marker} -->\n`);
		}
	};
	await new MdbaseSpecService(h.plugin).initialize();
	expect(fired).toBe(true);
	expect(h.files.get(target)).toContain(marker);
	expect([...h.files].some(([p, c]) => p.startsWith(METADATA_SWAPS) && p.endsWith(`/${target}`) && c.includes(marker))).toBe(true);
	expect(h.notices.join(" ")).toContain("Concurrent metadata change");
	expect(h.notices.some((n) => n.startsWith("TaskNotes updated"))).toBe(false);
});

it.each(targets)("never overwrites a %s arrival at no-clobber activation", async (target) => {
	const h = harness({ [target]: "original" });
	h.hooks.move = async (from, to) => {
		if (from.startsWith(`${target}.tasknotes-stage-`) && to === target) h.files.set(target, "SYNC ARRIVAL");
	};
	await expect(h.io.replace({ path: target, content: "original" }, "intended")).rejects.toThrow(/Concurrent/);
	expect(h.files.get(target)).toBe("SYNC ARRIVAL");
	expect([...h.files].some(([p, c]) => p.startsWith(METADATA_SWAPS) && p.endsWith(`/${target}`) && c === "original")).toBe(true);
	expect([...h.files].some(([p, c]) => p.includes(".tasknotes-stage-") && c === "intended")).toBe(true);
});

it.each(["v4-default", "beta3-custom"].flatMap((name) => ["before displacement", "after displacement", "after activation"].map((interval) => [name, interval])))
("cold startup recovers the real %s transaction interrupted %s", async (name, interval) => {
	const before = fixture(name);
	const h = harness(before);
	let interruptedFiles: Record<string, string> | undefined;
	const capture = (from: string, to: string, after: boolean) => {
		if (interruptedFiles) return;
		const displacement = from === "_types/task.md" && to.startsWith(METADATA_SWAPS);
		const activation = from.startsWith("_types/task.md.tasknotes-stage-") && to === "_types/task.md";
		if ((displacement && after === (interval === "after displacement") && interval !== "after activation") ||
			(activation && after && interval === "after activation")) interruptedFiles = Object.fromEntries(h.files);
	};
	h.hooks.move = async (from, to) => capture(from, to, false);
	h.hooks.afterMove = async (from, to) => capture(from, to, true);
	await new MdbaseSpecService(h.plugin).initialize();
	expect(interruptedFiles).toBeDefined();
	const restarted = harness(interruptedFiles!);
	restarted.plugin.settings = h.plugin.settings;
	await new MdbaseSpecService(restarted.plugin).initialize();
	expect((parseMdbaseTaskTypeDocument(restarted.files.get("_types/task.md")!).type as any).implements[0].version).toBe("0.3.0-rc.5");
	expect([...restarted.files.keys()].filter((p) => path.posix.dirname(p) === METADATA_SWAPS && p.endsWith(".json"))).toEqual([]);
	expect([...restarted.files.keys()].filter((p) => p.endsWith("-pending.json"))).toEqual([]);
});

const journalPath = `${METADATA_SWAPS}/interrupted.json`;
const interrupted: SwapJournal = {
	version: 1, snapshot: { path: "_types/task.md", content: "original" }, content: "intended",
	stage: "_types/task.md.tasknotes-stage-interrupted", recovery: `${METADATA_SWAPS}/interrupted/_types/task.md`,
};
it.each([
	["before displacement", "original", null, "intended", "original"],
	["after displacement", null, "original", "intended", "original"],
	["after publication before stage unlink", "intended", "original", "intended", "intended"],
	["after activation", "intended", "original", null, "intended"],
] as const)("recovers interrupted swap %s", async (_interval, active, moved, stage, expected) => {
	const h = harness({ [journalPath]: JSON.stringify(interrupted) });
	if (active !== null) h.files.set(interrupted.snapshot.path, active);
	if (moved !== null) h.files.set(interrupted.recovery, moved);
	if (stage !== null) h.files.set(interrupted.stage, stage);
	await h.io.recoverSwaps();
	expect(h.files.get(interrupted.snapshot.path)).toBe(expected);
	expect(h.files.has(journalPath)).toBe(false);
	expect(h.files.has(interrupted.stage)).toBe(false);
	if (moved !== null) expect(h.files.get(interrupted.recovery)).toBe(moved);
	await h.io.recoverSwaps();
});
it.each([null, "new arrival"])("retains displaced divergent bytes and refuses recovery when active is %s", async (active) => {
	const h = harness({ [journalPath]: JSON.stringify(interrupted), [interrupted.recovery]: "ACTUAL EDIT", [interrupted.stage]: "intended" });
	if (active !== null) h.files.set(interrupted.snapshot.path, active);
	await expect(h.io.recoverSwaps()).rejects.toThrow("Concurrent metadata change");
	expect(h.files.get(interrupted.snapshot.path)).toBe(active ?? "ACTUAL EDIT");
	expect(h.files.get(interrupted.recovery)).toBe("ACTUAL EDIT");
	expect(h.files.has(journalPath)).toBe(true);
	// An explicit user restoration resolves the block without deleting evidence.
	h.files.set(interrupted.snapshot.path, "original");
	await h.io.recoverSwaps();
	expect(h.files.get(interrupted.recovery)).toBe("ACTUAL EDIT");
	expect(h.files.has(journalPath)).toBe(false);
});
it("refuses a modified verified stage without removing any revision", async () => {
	const h = harness({ [journalPath]: JSON.stringify(interrupted), [interrupted.recovery]: "original", [interrupted.stage]: "CHANGED STAGE" });
	await expect(h.io.recoverSwaps()).rejects.toThrow("staging verification");
	expect(h.files.get(interrupted.stage)).toBe("CHANGED STAGE");
	expect(h.files.has(journalPath)).toBe(true);
});
it("names an unreadable swap journal and preserves every file", async () => {
	const h = harness({ [journalPath]: "{torn", [interrupted.snapshot.path]: "original", [interrupted.stage]: "intended" });
	const before = Object.fromEntries(h.files);
	await expect(h.io.recoverSwaps()).rejects.toThrow(journalPath);
	expect(Object.fromEntries(h.files)).toEqual(before);
});
it("new metadata creation never clobbers an arriving file", async () => {
	const h = harness({});
	h.hooks.move = async (_from, to) => { h.files.set(to, "NEW ARRIVAL"); };
	await expect(h.io.replace({ path: "mdbase.yaml", content: null }, "intended")).rejects.toThrow("already exists");
	expect(h.files.get("mdbase.yaml")).toBe("NEW ARRIVAL");
});
it("refuses adapters without a move instead of truncating active metadata", async () => {
	const h = harness({ "mdbase.yaml": "original" });
	(h.adapter as any).rename = undefined;
	await expect(h.io.replace({ path: "mdbase.yaml", content: "original" }, "intended")).rejects.toThrow("move unavailable");
	expect(h.files.get("mdbase.yaml")).toBe("original");
});

it.each(targets)("native %s move-boundary race retains actual bytes; link-boundary race keeps both revisions", async (target) => {
	const scratch = await fs.mkdtemp(path.join(process.env.TMPDIR!, "swap-native-"));
	const previousRequire = window.require;
	const desktop = Platform.isDesktop;
	window.require = require;
	(Platform as any).isDesktop = true;
	try {
		const full = (p: string) => path.join(scratch, p);
		await fs.mkdir(path.dirname(full(target)), { recursive: true });
		const adapter = {
			getBasePath: () => scratch,
			exists: async (p: string) => { try { await fs.stat(full(p)); return true; } catch { return false; } },
			read: (p: string) => fs.readFile(full(p), "utf8"),
			write: (p: string, c: string) => fs.writeFile(full(p), c),
			remove: (p: string) => fs.unlink(full(p)),
			mkdir: async (p: string) => { await fs.mkdir(full(p), { recursive: true }); },
			list: async (p: string) => ({ files: (await fs.readdir(full(p))).map((f) => `${p}/${f}`), folders: [] }),
			rename: async (from: string, to: string) => {
				if (await adapter.exists(to)) throw new Error("occupied");
				await fs.rename(full(from), full(to));
			},
		};
		await fs.writeFile(full(target), "original");
		let fired = false;
		const originalRename = fs.rename;
		const rename = jest.spyOn(require("node:fs/promises"), "rename").mockImplementation(async (from, to) => {
			if (!fired && from === full(target)) { fired = true; await fs.appendFile(full(target), " ACTUAL EDIT"); }
			return originalRename(from, to);
		});
		try {
			await expect(new SafeMetadata(adapter).replace({ path: target, content: "original" }, "intended")).rejects.toThrow("Concurrent metadata change");
			expect(fired).toBe(true);
			expect(await adapter.read(target)).toBe("original ACTUAL EDIT");
			const journalFile = (await fs.readdir(full(METADATA_SWAPS))).find((p) => p.endsWith(".json"))!;
			const journal = JSON.parse(await adapter.read(`${METADATA_SWAPS}/${journalFile}`)) as SwapJournal;
			expect(await adapter.read(journal.recovery)).toBe("original ACTUAL EDIT");
		} finally { rename.mockRestore(); }
		// Resolve the scratch conflict; then inject a new arrival inside fs.link,
		// after every preflight read but before no-clobber publication.
		await fs.writeFile(full(target), "original");
		await new SafeMetadata(adapter).recoverSwaps();
		const originalLink = fs.link;
		let arrived = false;
		const link = jest.spyOn(require("node:fs/promises"), "link").mockImplementation(async (from, to) => {
			if (!arrived && to === full(target)) { arrived = true; await fs.writeFile(full(target), "NEW ARRIVAL"); }
			return originalLink(from, to);
		});
		try {
			await expect(new SafeMetadata(adapter).replace({ path: target, content: "original" }, "intended")).rejects.toThrow("Concurrent metadata change");
			expect(arrived).toBe(true);
			expect(await adapter.read(target)).toBe("NEW ARRIVAL");
			const siblings = await fs.readdir(path.dirname(full(target)));
			expect(siblings.some((p) => p.includes(".tasknotes-stage-"))).toBe(true);
			const retained = await fs.readdir(full(METADATA_SWAPS), { withFileTypes: true });
			expect(retained.filter((p) => p.isDirectory()).length).toBeGreaterThanOrEqual(2);
		} finally { link.mockRestore(); }
	} finally {
		(Platform as any).isDesktop = desktop;
		window.require = previousRequire;
		await fs.rm(scratch, { recursive: true, force: true });
	}
});
