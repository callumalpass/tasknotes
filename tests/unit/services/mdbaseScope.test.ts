import fs from "fs";
import path from "path";
import YAML from "yaml";
import { TFile } from "obsidian";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { MdbaseSpecService } from "../../../src/services/MdbaseSpecService";
import { parseMdbaseTaskTypeDocument, applyCanonicalTaskTypeToSettings, buildTaskNotesModelConfig, mergeCanonicalTaskTypeDocument } from "../../../src/services/mdbaseCanonicalConfig";
import { applyTaskExclusions, addAppCollectionConfig } from "../../../src/services/mdbase/collectionConfig";
import { checkCollection, repairCollectionRecord } from "../../../src/services/mdbase/checkCollection";
import { buildTaskNotesMdbaseResources } from "@tasknotes/model/mdbase";
import { recognitionVault } from "../../helpers/mdbaseRecognitionVault";

const root = path.join(__dirname, "../../fixtures/mdbase-upgrades");
const defaults = () => JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
const typeOf = (markdown: string): any => parseMdbaseTaskTypeDocument(markdown).type;
function capture(name: string): Record<string, string> {
	const entries: Record<string, string> = {};
	const walk = (folder: string, prefix = "") => {
		for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
			const relative = prefix + entry.name;
			if (entry.isDirectory()) walk(path.join(folder, entry.name), `${relative}/`);
			else if (entry.name !== "README.md") entries[relative] = fs.readFileSync(path.join(folder, entry.name), "utf8");
		}
	};
	walk(path.join(root, name)); return entries;
}
function harness(entries: Record<string, string>, settings = defaults()) {
	const h = recognitionVault(entries);
	const file = (p: string) => Object.assign(new (TFile as any)(p), { stat: { ctime: Date.UTC(2026, 0, 1), mtime: 1, size: 1 } });
	const originalList = h.vault.adapter.list;
	h.vault.adapter.list = async (folder) => folder ? originalList(folder) : {
		files: [...h.files.keys()].filter((p) => !p.includes("/")),
		folders: [...new Set([...h.files.keys()].filter((p) => p.includes("/")).map((p) => p.split("/")[0]))],
	};
	const vault: any = { ...h.vault, configDir: ".obsidian", getFiles: () => [...h.files.keys()].map(file), getMarkdownFiles: () => [...h.files.keys()].filter((p) => p.endsWith(".md")).map(file), read: async (f: TFile) => h.files.get(f.path) };
	const notices: string[] = [];
	const plugin: any = { settings: { ...settings, enableMdbaseSpec: true }, app: { vault }, registerEvent: jest.fn(), saveSettingsDataOnly: jest.fn(), emitter: { trigger: (_event: string, message: any) => notices.push(String(message?.message ?? message)) } };
	return { ...h, plugin, notices, service: new MdbaseSpecService(plugin) };
}
const invalid = (membership = "type: task\n") => `---\n${membership}status: open\n---\nUnchanged body\n`;
function minimal() {
	const entries = capture("meaning-minimal"); delete entries["Tasks/Matrix 0.md"];
	const config = YAML.parse(entries["mdbase.yaml"]); delete config.settings.explicit_type_keys;
	entries["mdbase.yaml"] = YAML.stringify(config); return entries;
}

describe("BOM metadata and record membership", () => {
	it.each(["\n", "\r\n"])("COMPAT-R02: preserves a provider referenced by a BOM %j record", async (newline) => {
		const entries = capture("scope-bom-reference"); entries["bom-explicit.md"] = entries["bom-explicit.md"].replace(/\r?\n/g, newline);
		const h = harness(entries); await h.service.initialize();
		expect(h.files.get("_types/tasknotes-task.md")).toBe(entries["_types/tasknotes-task.md"]);
		expect(h.files.get("bom-explicit.md")).toBe(entries["bom-explicit.md"]);
		expect(h.notices.join("\n")).toContain("bom-explicit.md");
	});
	it.each(["---\ntype: [broken\n---\n", "\ufeff---\r\ntype: tasknotes-task\r\n", "---\n[tasknotes-task]\n---\n"])("keeps providers on unparseable membership %j", async (content) => {
		const entries = capture("scope-bom-reference"); delete entries["bom-explicit.md"]; entries["malformed.md"] = content;
		const h = harness(entries); await h.service.initialize();
		expect(h.files.get("_types/tasknotes-task.md")).toBe(entries["_types/tasknotes-task.md"]);
		expect(h.notices.join("\n")).toContain("malformed.md");
	});
	it.each(["beta0-custom", "app-rc17-default"])("COMPAT-R03/MATRIX-R01: cold BOM canonical %s reconciles", async (name) => {
		const fixture = JSON.parse(fs.readFileSync(path.join(root, `${name}.json`), "utf8"));
		for (const newline of ["\n", "\r\n"]) {
			const entries = { ...fixture.files }; entries["_types/task.md"] = "\ufeff" + entries["_types/task.md"].replace(/\r?\n/g, newline);
			const h = harness(entries); h.plugin.settings.excludedFolders = "Private"; await h.service.initialize();
			const type = typeOf(h.files.get("_types/task.md")!);
			expect(type.implements[0].version).toBe("0.3.0-rc.5");
			expect(type.match.expr.$expr).toContain("Private/");
			expect(h.notices.join("\n")).not.toMatch(/frontmatter|stopped/);
			expect([...h.files.values()]).toContain(entries["_types/task.md"]);
			for (const [p, content] of Object.entries(entries)) if (!p.startsWith("_") && p.endsWith(".md")) expect(h.files.get(p)).toBe(content);
		}
	});
	it("all transforms accept BOM/CRLF while preserving the body", () => {
		const generated = buildTaskNotesMdbaseResources();
		const source = "\ufeff" + generated.typeDocument.replace(/\n/g, "\r\n");
		const excluded = applyTaskExclusions(source, "Private");
		expect(parseMdbaseTaskTypeDocument(excluded).body).toBe(parseMdbaseTaskTypeDocument(source).body);
		expect(parseMdbaseTaskTypeDocument(mergeCanonicalTaskTypeDocument(source, generated)).body).toBe(parseMdbaseTaskTypeDocument(source).body);
	});
});

describe("engine-effective Check collection scope", () => {
	it.each(["type: TASK\n", "types: [other, task]\n", "kind: task\n"])("MATRIX-R02/ADV-R02/PATHS-R03: explicit excluded members %j are checked", async (membership) => {
		const entries = minimal(); const config = YAML.parse(entries["mdbase.yaml"]);
		if (membership.startsWith("kind")) config.settings.explicit_type_keys = ["kind"];
		entries["mdbase.yaml"] = YAML.stringify(config);
		entries["Private/explicit.md"] = "\ufeff" + invalid(membership).replace(/\n/g, "\r\n");
		entries["Private/tag.md"] = invalid("tags: [task]\n");
		entries["foreign.md"] = invalid(`${membership.startsWith("kind") ? "kind" : "type"}: book\ntags: [task]\n`);
		const h = harness(entries); h.plugin.settings.excludedFolders = "Private"; await h.service.initialize();
		// Real Obsidian vault.read strips BOM, but adapter.read and vault.process retain it.
		h.plugin.app.vault.read = async (file: TFile) => h.files.get(file.path)?.replace(/^\ufeff/, "");
		const problems = await checkCollection(h.plugin);
		expect(problems.map((p) => p.file.path)).toEqual(["Private/explicit.md"]);
		const backup = await repairCollectionRecord(h.plugin, problems[0]);
		expect(h.files.get(backup!)).toBe(entries["Private/explicit.md"]);
		expect(h.files.get("Private/explicit.md")).toMatch(/^\ufeff---/);
		expect(h.files.get("Private/tag.md")).toBe(entries["Private/tag.md"]);
		expect(await checkCollection(h.plugin)).toEqual([]);
	});
	it("match operators and path_globs remain conjunctive without overriding explicit membership", async () => {
		const entries = minimal(); const type = typeOf(entries["_types/task.md"]);
		type.match.where.tags = { contains: "task", eq: ["task", "public"] };
		type.match.path_glob = "Visible/**/*.md";
		type.match.path_globs = ["**/public/*.md"];
		entries["_types/task.md"] = `---\n${YAML.stringify(type)}---\n`;
		entries["Visible/public/member.md"] = invalid("tags: [task, public]\n");
		entries["Visible/public/not-member.md"] = invalid("tags: [task]\n");
		entries["Visible/private/not-member.md"] = invalid("tags: [task, public]\n");
		entries["Other/explicit.md"] = invalid();
		const h = harness(entries);
		expect((await checkCollection(h.plugin)).map((p) => p.file.path)).toEqual(["Visible/public/member.md", "Other/explicit.md"]);
	});
	it("COMPAT-R04: include_subfolders false never offers nested repairs", async () => {
		const entries = minimal(); const config = YAML.parse(entries["mdbase.yaml"]); config.settings.include_subfolders = false;
		entries["mdbase.yaml"] = YAML.stringify(config); entries["root.md"] = invalid(); entries["nested/outside.md"] = invalid();
		const h = harness(entries);
		expect((await checkCollection(h.plugin)).map((p) => p.file.path)).toEqual(["root.md"]);
		expect(h.files.get("nested/outside.md")).toBe(entries["nested/outside.md"]);
	});
	it.each(["Private", "Private/**", "*.draft.md", "Secret*"])("collection-wide exclude %s overrides explicit membership", async (pattern) => {
		const entries = minimal(); const config = YAML.parse(entries["mdbase.yaml"]); config.settings.exclude = [pattern];
		entries["mdbase.yaml"] = YAML.stringify(config);
		const excludedPath = pattern.startsWith("Private") ? "Private/outside.md" : pattern.startsWith("*.") ? "nested/outside.draft.md" : "Secret/outside.md";
		entries[excludedPath] = invalid(); const h = harness(entries); expect(await checkCollection(h.plugin)).toEqual([]);
	});
	it("nested collections and custom metadata folders are never repaired", async () => {
		const entries = minimal(); const config = YAML.parse(entries["mdbase.yaml"]);
		config.settings.contracts_folder = "contracts"; config.settings.cache_folder = "cache"; config.settings.migrations_folder = "moves";
		entries["mdbase.yaml"] = YAML.stringify(config);
		for (const folder of ["contracts", "cache", "moves", ".mdbase", "nested"]) entries[`${folder}/invalid.md`] = invalid();
		entries["nested/mdbase.yaml"] = "spec_version: 0.3.0\n";
		const h = harness(entries); expect(await checkCollection(h.plugin)).toEqual([]);
	});
	it("checks configured non-md record extensions", async () => {
		const entries = minimal(); const config = YAML.parse(entries["mdbase.yaml"]); config.settings.record_extensions = ["md", "mdx"];
		entries["mdbase.yaml"] = YAML.stringify(config); entries["invalid.mdx"] = invalid(); entries["outside.txt"] = invalid();
		const h = harness(entries); expect((await checkCollection(h.plugin)).map((p) => p.file.path)).toEqual(["invalid.mdx"]);
	});
	it("refuses a repair when collection scope changed after preview", async () => {
		const entries = minimal(); entries["Private/record.md"] = invalid(); const h = harness(entries);
		const [problem] = await checkCollection(h.plugin); const config = YAML.parse(entries["mdbase.yaml"]); config.settings.exclude = ["Private/**"];
		h.files.set("mdbase.yaml", YAML.stringify(config));
		await expect(repairCollectionRecord(h.plugin, problem)).rejects.toThrow("Collection membership");
		expect(h.files.get("Private/record.md")).toBe(entries["Private/record.md"]);
	});
	it("never reports a clean partial scan for malformed membership", async () => {
		const entries = minimal(); entries["malformed.md"] = "\ufeff---\r\ntype: [broken\r\n---\r\n"; const h = harness(entries);
		await expect(checkCollection(h.plugin)).rejects.toThrow("malformed.md");
	});
	it.each([false, true])("duplicate-reference inventory shares collection scope (shallow=%s)", async (shallow) => {
		const entries = capture("scope-bom-reference"); delete entries["bom-explicit.md"];
		const config = YAML.parse(entries["mdbase.yaml"]);
		if (shallow) config.settings.include_subfolders = false; else config.settings.exclude = ["Private/**"];
		entries["mdbase.yaml"] = YAML.stringify(config); entries["Private/reference.md"] = invalid("type: tasknotes-task\n");
		const h = harness(entries); await h.service.initialize();
		expect(h.files.has("_types/tasknotes-task.md")).toBe(false);
		expect(h.files.get("Private/reference.md")).toBe(entries["Private/reference.md"]);
	});
});

describe("additive App configuration and user fields", () => {
	it("ADV-R03: duplicate user Base includes cannot mask the required addition", () => {
		const before = "spec_version: 0.3.0\nsettings:\n  record_extensions: [md]\nx-obsidian:\n  bases:\n    include: [Custom/**/*.base, Custom/**/*.base]\n";
		const after = addAppCollectionConfig(before, defaults());
		expect(YAML.parse(after)["x-obsidian"].bases.include).toEqual(["Custom/**/*.base", "Custom/**/*.base", "TaskNotes/Views/**/*.base"]);
		expect(addAppCollectionConfig(after, defaults())).toBe(after);
	});
	it("MATRIX-R03: all five historical user-field kinds survive import and later settings saves", async () => {
		const entries = capture("scope-userfields"); const settings = JSON.parse(entries["settings.json"]); delete entries["settings.json"];
		const h = harness(entries, settings); await h.service.initialize();
		expect(h.plugin.settings.userFields).toEqual(settings.userFields.map(({ filterDisplay: _unused, ...field }: any) => field));
		h.plugin.settings.customPriorities[0].label = "Unrelated priority label"; await h.service.onSettingsChanged();
		const type = typeOf(h.files.get("_types/task.md")!);
		for (const field of settings.userFields) expect(type.schema.value.properties[field.key]).toBeDefined();
		await h.service.reloadCanonicalSettingsFromDisk();
		expect(h.plugin.settings.userFields.map((f: any) => f.type)).toEqual(["text", "number", "date", "boolean", "list"]);
		for (const [p, content] of Object.entries(entries)) if (!p.startsWith("_") && p.endsWith(".md")) expect(h.files.get(p)).toBe(content);
	});
	it.each([true, false])("every field kind/default/local option round-trips (legacy=%s)", (legacyCompatibility) => {
		const settings = defaults();
		settings.userFields = [
			{ id: "t", key: "custom_text", displayName: "Text", type: "text", defaultValue: "kept" },
			{ id: "n", key: "custom_number", displayName: "Number", type: "number", defaultValue: 12 },
			{ id: "d", key: "custom_date", displayName: "Date", type: "date", defaultValue: "2026-01-01" },
			{ id: "b", key: "custom_boolean", displayName: "Boolean", type: "boolean", defaultValue: false },
			{ id: "l", key: "custom_list", displayName: "List", type: "list", defaultValue: ["kept"], autosuggestFilter: { enabled: true } },
		];
		const before = JSON.parse(JSON.stringify(settings.userFields));
		const resources = buildTaskNotesMdbaseResources({ modelConfig: buildTaskNotesModelConfig(settings), legacyCompatibility });
		applyCanonicalTaskTypeToSettings(settings, resources.type as any); expect(settings.userFields).toEqual(before);
		const merged = mergeCanonicalTaskTypeDocument(resources.typeDocument, buildTaskNotesMdbaseResources({ modelConfig: buildTaskNotesModelConfig(settings), legacyCompatibility }));
		applyCanonicalTaskTypeToSettings(settings, typeOf(merged)); expect(settings.userFields).toEqual(before);
	});
	it("names genuinely unresolved owned fields and preserves metadata through later settings saves", async () => {
		const entries = minimal();
		const type = typeOf(entries["_types/task.md"]);
		type.schema.value.properties.unresolved = { type: "object" };
		type["x-tasknotes-generator"].managed_fields.push("unresolved");
		entries["_types/task.md"] = `---\n${YAML.stringify(type)}---\n`;
		const h = harness(entries); await h.service.initialize();
		expect(h.notices.join("\n")).toContain("unresolved");
		expect(h.notices.join("\n")).toContain("_types/task.md");
		h.plugin.settings.customPriorities[0].label = "Unrelated change";
		await expect(h.service.onSettingsChanged()).rejects.toThrow("unresolved");
		expect(h.files.get("_types/task.md")).toBe(entries["_types/task.md"]);
	});
	it("refuses genuinely unresolved owned fields before changing settings", () => {
		const settings = defaults(); const resources = buildTaskNotesMdbaseResources({ modelConfig: buildTaskNotesModelConfig(settings) });
		const type: any = resources.type; type.schema.value.properties.unresolved = { type: "object" }; type["x-tasknotes-generator"].managed_fields.push("unresolved");
		const before = JSON.parse(JSON.stringify(settings));
		expect(() => applyCanonicalTaskTypeToSettings(settings, type)).toThrow("unresolved"); expect(settings).toEqual(before);
	});
});
