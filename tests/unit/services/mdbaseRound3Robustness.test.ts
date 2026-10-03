import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { TFile } from "obsidian";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { MdbaseSpecService } from "../../../src/services/MdbaseSpecService";
import { SettingsLifecycleService } from "../../../src/services/SettingsLifecycleService";
import { checkCollection, repairCollectionRecord } from "../../../src/services/mdbase/checkCollection";
import { addAppCollectionConfig } from "../../../src/services/mdbase/collectionConfig";
import { collectionScope } from "../../../src/services/mdbase/collectionMembership";
import { findExplicitTypeReference } from "../../../src/services/mdbase/ExplicitTypeReferences";
import { parseMdbaseTaskTypeDocument, validateCanonicalTaskType } from "../../../src/services/mdbaseCanonicalConfig";
import { recognitionVault } from "../../helpers/mdbaseRecognitionVault";

const root = path.join(__dirname, "../../fixtures/mdbase-upgrades");
const defaults = () => JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
function capture(name: string): Record<string, string> {
	const files: Record<string, string> = {};
	const walk = (folder: string, prefix = "") => {
		for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
			if (entry.isDirectory()) walk(path.join(folder, entry.name), `${prefix}${entry.name}/`);
			else if (entry.name !== "README.md") files[prefix + entry.name] = fs.readFileSync(path.join(folder, entry.name), "utf8");
		}
	};
	walk(path.join(root, name)); return files;
}
function harness(entries: Record<string, string>) {
	const settings = entries["settings.json"] ? JSON.parse(entries["settings.json"]) : defaults();
	entries = { ...entries }; delete entries["settings.json"];
	const h = recognitionVault(entries);
	const file = (p: string) => Object.assign(new (TFile as any)(p), { stat: { ctime: Date.UTC(2026, 0, 1), mtime: 1, size: 1 } });
	const originalList = h.vault.adapter.list;
	h.vault.adapter.list = async (folder) => folder ? originalList(folder) : {
		files: [...h.files.keys()].filter((p) => !p.includes("/")),
		folders: [...new Set([...h.files.keys()].filter((p) => p.includes("/")).map((p) => p.split("/")[0]))],
	};
	const vault: any = { ...h.vault, getFiles: () => [...h.files.keys()].map(file), getMarkdownFiles: () => [...h.files.keys()].filter((p) => p.endsWith(".md")).map(file) };
	const notices: string[] = [];
	const plugin: any = { settings: { ...settings, enableMdbaseSpec: true }, app: { vault }, registerEvent: jest.fn(), saveSettingsDataOnly: jest.fn(), emitter: { trigger: (_event: string, payload: any) => notices.push(String(payload?.message ?? payload)) } };
	const service = new MdbaseSpecService(plugin); plugin.mdbaseSpecService = service;
	return { ...h, plugin, service, notices };
}
const typeOf = (h: ReturnType<typeof harness>): any => parseMdbaseTaskTypeDocument(h.files.get("_types/task.md")!).type;
const setType = (h: ReturnType<typeof harness>, type: any) => h.files.set("_types/task.md", `---\n${YAML.stringify(type)}---\n`);
const invalid = "---\ntags: [task]\nmeta: {kind: action}\nstatus: open\n---\nUnchanged body\n";

describe("collection migration robustness", () => {
	it("retains captured legacy-extension membership across cold initialization and idempotent reload", async () => {
		const entries = capture("round3-legacy-extensions"); const h = harness(entries);
		expect(h.plugin.fieldMapper).toBeUndefined();
		expect(collectionScope(YAML.parse(entries["mdbase.yaml"])).isRecord("portable.mdx")).toBe(true);
		await h.service.initialize();
		expect(YAML.parse(h.files.get("mdbase.yaml")!).settings.record_extensions).toEqual(["md", "mdx", "base"]);
		expect(collectionScope(YAML.parse(h.files.get("mdbase.yaml")!)).isRecord("portable.mdx")).toBe(true);
		expect(h.files.get("portable.mdx")).toBe(entries["portable.mdx"]);
		const after = Object.fromEntries(h.files); await new MdbaseSpecService(h.plugin).initialize();
		expect(Object.fromEntries(h.files)).toEqual(after);
	});
	it.each([undefined, null])("resolves legacy extensions when the modern value is %s, with one-dot normalization", (modern) => {
		const settings = { record_extensions: modern, extensions: [".mdx", "md", "mdx"] };
		expect(collectionScope({ settings }).isRecord("record.mdx")).toBe(true);
		const config = YAML.parse(addAppCollectionConfig(YAML.stringify({ spec_version: "0.3.0", settings }), defaults()));
		expect(config.settings.record_extensions).toEqual(["md", "mdx", "mdx", "base"]);
		expect(config.settings.extensions).toEqual(settings.extensions);
	});
	it("modern extensions override legacy coverage, including an explicit empty list", () => {
		for (const record_extensions of [["md", "txt"], []]) {
			expect(collectionScope({ settings: { record_extensions, extensions: ["mdx"] } }).isRecord("record.mdx")).toBe(false);
		}
	});
	it.each(["mdx", ["mdx", 1], {}])("refuses invalid legacy values %j before config mutation or scanning", (extensions) => {
		const before = YAML.stringify({ settings: { record_extensions: ["md"], extensions } });
		expect(() => addAppCollectionConfig(before, defaults())).toThrow("extensions");
		expect(() => collectionScope(YAML.parse(before))).toThrow("extensions");
	});
	it("explicit-reference inventory sees a legacy non-Markdown record", async () => {
		const h = harness(capture("round3-legacy-extensions"));
		h.files.set("portable.mdx", "---\ntype: duplicate\n---\nRetain provider\n");
		const reference = await findExplicitTypeReference(h.plugin.app.vault.adapter, [{ path: "_types/duplicate.md", type: { name: "duplicate" } }], YAML.parse(h.files.get("mdbase.yaml")!));
		expect(reference?.recordPath).toBe("portable.mdx");
	});
	it("Check collection sees a legacy-extension record before migration", async () => {
		const h = harness(capture("round3-legacy-extensions"));
		h.files.set("portable.mdx", "---\ntype: task\nstatus: open\n---\n");
		expect((await checkCollection(h.plugin)).map((p) => p.file.path)).toContain("portable.mdx");
	});
});

describe("engine membership edge cases", () => {
	it("reports the captured nested-presence engine member, not a false clean scan", async () => {
		const h = harness(capture("round3-nested-presence"));
		expect((await checkCollection(h.plugin)).map((p) => p.file.path)).toEqual(["invalid.md"]);
	});
	it.each([
		["meta.kind", { meta: { kind: "action" } }],
		["items[].kind", { items: [{ absent: true }, { kind: "action" }] }],
		["/items/1/kind", { items: [{}, { kind: "action" }] }],
		["/a~1b/~0key", { "a/b": { "~key": "action" } }],
	])("resolves presence and where through engine field reference %s", async (reference, fields) => {
		const h = harness(capture("round3-glob-array")); const type = typeOf(h);
		type.match = { fields_present: [reference], where: { [reference]: { eq: "action" } } }; setType(h, type);
		h.files.set("nested.md", `---\n${YAML.stringify({ ...fields, status: "open" })}---\n`);
		expect((await checkCollection(h.plugin)).map((p) => p.file.path)).toEqual(["nested.md"]);
	});
	it("first selected null, empty arrays and absent nested keys do not satisfy presence", async () => {
		const h = harness(capture("round3-glob-array")); const type = typeOf(h);
		type.match = { where: { tags: { contains: "task" } }, fields_present: ["items[].kind"] }; setType(h, type);
		for (const [name, items] of Object.entries({ null: [{ kind: null }, { kind: true }], empty: [], missing: [{}] })) h.files.set(`${name}.md`, `---\n${YAML.stringify({ tags: ["task"], items })}---\n`);
		expect(await checkCollection(h.plugin)).toEqual([]);
	});
	it.each([{ fields_present: ["meta[0].kind"] }, { fields_present: "meta.kind" }, { where: { "meta.kind": { gt: 1 } } }, { path_glob: [1] }, { unsupported: true }, { where: [] }])("refuses unsupported predicates %j instead of a partial clean scan", async (match) => {
		const h = harness(capture("round3-glob-array")); const type = typeOf(h); type.match = { ...type.match, ...match }; setType(h, type);
		await expect(checkCollection(h.plugin)).rejects.toThrow(/validate|match/);
	});
	it("array path_glob excludes the captured outside record from check and approved repair", async () => {
		const h = harness(capture("round3-glob-array")); const original = h.files.get("outside.md");
		const type = typeOf(h); delete type.match.path_glob; setType(h, type);
		const [oldPreview] = await checkCollection(h.plugin); expect(oldPreview.file.path).toBe("outside.md");
		type.match.path_glob = ["TaskNotes/Tasks/*.md"]; setType(h, type);
		expect(await checkCollection(h.plugin)).toEqual([]);
		await expect(repairCollectionRecord(h.plugin, oldPreview)).rejects.toThrow("membership");
		expect(h.files.get("outside.md")).toBe(original);
	});
	it("array path_glob ORs entries while remaining conjunctive with where and presence", async () => {
		const h = harness(capture("round3-glob-array")); const type = typeOf(h);
		type.match.path_glob = ["One/*.md", "Two/*.md"]; type.match.fields_present = ["meta.kind"]; setType(h, type);
		for (const folder of ["One", "Two", "Other"]) h.files.set(`${folder}/invalid.md`, invalid);
		h.files.set("One/non-member.md", invalid.replace("tags: [task]", "tags: [paper]"));
		expect((await checkCollection(h.plugin)).map((p) => p.file.path)).toEqual(["One/invalid.md", "Two/invalid.md"]);
	});
});

describe("approved repair robustness", () => {
	it("refuses a stale status choice against the current valid vocabulary without backup or record writes", async () => {
		const h = harness(capture("round3-glob-array")); h.files.delete("outside.md");
		h.files.set("TaskNotes/Tasks/stale.md", "---\ntags: [task]\ntitle: Stale status\nstatus: unknown\ndateCreated: 2026-01-01T00:00:00Z\n---\nBody\n");
		const [preview] = await checkCollection(h.plugin); expect(preview.statusValues).toContain("open");
		const type = JSON.parse(JSON.stringify(typeOf(h)).replace(/"open"/g, '"queued"'));
		expect(validateCanonicalTaskType(type).valid).toBe(true); setType(h, type);
		const before = Object.fromEntries(h.files);
		await expect(repairCollectionRecord(h.plugin, preview, "open")).rejects.toThrow("allowed status");
		expect(Object.fromEntries(h.files)).toEqual(before);
	});
	it("valid unchanged status repair is backed up and validates cleanly", async () => {
		const h = harness(capture("round3-glob-array")); h.files.delete("outside.md");
		const record = "---\ntags: [task]\ntitle: Status\nstatus: unknown\ndateCreated: 2026-01-01T00:00:00Z\n---\nBody\n";
		h.files.set("TaskNotes/Tasks/status.md", record); const [problem] = await checkCollection(h.plugin);
		const backup = await repairCollectionRecord(h.plugin, problem, "open");
		expect(h.files.get(backup!)).toBe(record); expect(await checkCollection(h.plugin)).toEqual([]);
	});
	it("validates proposed output against current schema before introducing new failures", async () => {
		const h = harness(capture("round3-glob-array")); h.files.delete("outside.md");
		const type = typeOf(h);
		type.schema.value.allOf = [{ if: { properties: { status: { const: "open" } } }, then: { required: ["confirmation"] } }]; setType(h, type);
		h.files.set("TaskNotes/Tasks/status.md", "---\ntags: [task]\ntitle: Status\nstatus: unknown\ndateCreated: 2026-01-01T00:00:00Z\n---\nBody\n");
		const problem = (await checkCollection(h.plugin)).find((p) => p.file.path === "TaskNotes/Tasks/status.md")!;
		const before = Object.fromEntries(h.files);
		await expect(repairCollectionRecord(h.plugin, problem, "open")).rejects.toThrow("proposed repair");
		expect(Object.fromEntries(h.files)).toEqual(before);
	});
	it("settings-save conflict immediately reports the affected path, recovery folder and resolution guidance once", async () => {
		const h = harness(capture("round3-legacy-extensions")); await h.service.initialize(); h.notices.length = 0;
		const original = h.plugin.app.vault.adapter.rename; let fired = false;
		h.plugin.app.vault.adapter.rename = async (from: string, to: string) => {
			if (!fired && from === "_types/task.md" && to.includes("/metadata-swaps/")) { fired = true; h.files.set(from, h.files.get(from)! + "\n# ROBUSTNESS SETTINGS REVISION\n"); }
			return original(from, to);
		};
		h.plugin.settings.excludedFolders = "Private";
		h.plugin.cacheManager = { updateConfig: jest.fn() }; h.plugin.injectCustomStyles = jest.fn(); h.plugin.notifyDataChanged = jest.fn();
		h.plugin.emitter.on = jest.fn(); h.plugin.emitter.offref = jest.fn();
		const lifecycle = new SettingsLifecycleService(h.plugin); await lifecycle.saveSettings();
		expect(fired).toBe(true); expect(h.plugin.saveSettingsDataOnly).toHaveBeenCalled();
		const notice = h.notices.find((message) => message.includes("saved your settings"))!;
		expect(notice).toContain("_types/task.md"); expect(notice).toContain(".tasknotes/migrations/metadata-swaps/"); expect(notice).toMatch(/resolve.*reload/);
		const error = new Error("_types/task.md; pending record: .tasknotes/migrations/metadata-swaps/example.json");
		h.service.onSettingsChanged = jest.fn().mockRejectedValue(error);
		await lifecycle.saveSettings(); await lifecycle.saveSettings();
		expect(h.notices.filter((message) => message.includes("example.json"))).toHaveLength(1);
		expect(h.files.get("_types/task.md")).toContain("ROBUSTNESS SETTINGS REVISION");
	});
});
