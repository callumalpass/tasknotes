import fs from "fs";
import path from "path";
import YAML from "yaml";
import type TaskNotesPlugin from "../../../src/main";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { MdbaseSpecService } from "../../../src/services/MdbaseSpecService";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { parseMdbaseTaskTypeDocument } from "../../../src/services/mdbaseCanonicalConfig";
import { hasLegacyFieldsSchema, recognizeLegacyTaskType } from "../../../src/services/mdbase/legacyRecognition";
import { renderHistoricalTaskTypes } from "../../../src/services/mdbase/historicalTaskTypeRenderers";
import { recognitionVault } from "../../helpers/mdbaseRecognitionVault";

const root = path.join(__dirname, "../../fixtures/mdbase-upgrades/recognition");
const captures = fs.readdirSync(root).filter((name) => !name.includes("edited"));
function captured(name: string) {
	const dir = path.join(root, name);
	const entries: Record<string, string> = {};
	const walk = (folder: string) => {
		for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
			const filename = path.join(folder, entry.name);
			if (entry.isDirectory()) walk(filename);
			else if (!["README.md", "settings.json"].includes(entry.name)) {
				entries[path.relative(dir, filename)] = fs.readFileSync(filename, "utf8");
			}
		}
	};
	walk(dir);
	const settings = fs.existsSync(path.join(dir, "settings.json"))
		? JSON.parse(fs.readFileSync(path.join(dir, "settings.json"), "utf8"))
		: JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
	settings.enableMdbaseSpec = true;
	return { entries, settings };
}
function harness(name = "live-4.9.2-defaults", edit: (entries: Record<string, string>) => void = () => {}) {
	const { entries, settings } = captured(name);
	edit(entries);
	const memory = recognitionVault(entries);
	const notices: string[] = [];
	// Deliberately no pre-injected runtime FieldMapper.
	const plugin = {
		settings, app: { vault: memory.vault }, registerEvent: jest.fn(),
		emitter: { trigger: (_event: string, payload: { message: string }) => notices.push(payload.message) },
		saveSettingsDataOnly: jest.fn().mockResolvedValue(undefined),
	} as unknown as TaskNotesPlugin;
	const service = new MdbaseSpecService(plugin);
	return { ...memory, entries, settings, plugin, notices, service };
}
function assertMigrated(h: ReturnType<typeof harness>, typePath = "_types/task.md") {
	expect(YAML.parse(h.files.get("mdbase.yaml")!).spec_version).toBe("0.3.0");
	const type = parseMdbaseTaskTypeDocument(h.files.get(typePath)!).type;
	expect(type.implements).toEqual(expect.arrayContaining([expect.objectContaining({ contract: "tasknotes.task" })]));
	expect([...h.files.keys()].filter((p) => p.startsWith(typePath.split("/")[0] + "/") && p.endsWith(".md") && p.includes("task"))).toEqual([typePath]);
	for (const [p, content] of Object.entries(h.entries)) {
		if (p.startsWith("Tasks/")) expect(h.files.get(p)).toBe(content);
	}
	expect(h.notices.some((n) => /could not initialize|needs review|legacy metadata is missing/.test(n))).toBe(false);
	const backup = [...h.files.entries()].find(([p]) => p.endsWith("/task.md.bak"));
	expect(backup?.[1]).toBe(h.entries[typePath]);
}

describe("historical generated type recognition", () => {
	it.each(captures)("recognizes captured %s independently of the bootstrap-order fix", async (name) => {
		const h = harness(name);
		h.plugin.fieldMapper = new FieldMapper(h.settings.fieldMapping);
		await h.service.initialize();
		assertMigrated(h, name.includes("foreign-v03") ? "LibraryTypes/task.md" : "_types/task.md");
		if (name.includes("foreign-v03")) {
			expect(h.files.get("LibraryTypes/book.md")).toBe(h.entries["LibraryTypes/book.md"]);
			expect(YAML.parse(h.files.get("mdbase.yaml")!)["x-library"]).toEqual({ keep: true });
		}
		const before = new Map(h.files);
		await h.service.initialize();
		expect(h.files).toEqual(before);
	});

	it("recognition and migration do not require any pre-injected runtime mapper", async () => {
		const h = harness("writer-4.12.0");
		expect(h.plugin.fieldMapper).toBeUndefined();
		await h.service.initialize();
		assertMigrated(h);
		expect(h.plugin.fieldMapper).toBeUndefined();
	});

	it("frozen renderers reproduce independent historical source captures byte-for-byte", () => {
		const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
		for (const { version, document } of renderHistoricalTaskTypes(settings)) {
			expect(document).toBe(captured(`writer-${version}`).entries["_types/task.md"]);
		}
	});

	it.each(["live-4.13.7-edited", "writer-4.3.2"])("preserves edited %s and names the file and recovery steps", async (name) => {
		const h = harness(name, (entries) => { if (name.startsWith("writer")) entries["_types/task.md"] += "\nUser-maintained body\n"; });
		const before = new Map(h.files);
		await h.service.initialize();
		expect(h.files).toEqual(before);
		expect(h.notices.join(" ")).toMatch(/_types\/task.md.*backed-up copy with mdbase/);
	});

	it("does not mistake invalid edited enum YAML for exact old writer output", () => {
		const { entries, settings } = captured("live-4.13.7-punctuation");
		expect(() => parseMdbaseTaskTypeDocument(entries["_types/task.md"])).toThrow();
		expect(recognizeLegacyTaskType(entries["_types/task.md"] + "\nUser edit\n", settings)).toBe(false);
	});

	it("compares mappings without key order but does not reorder sequences or ignore schema edits", () => {
		const { entries, settings } = captured("writer-4.12.0");
		const parsed = parseMdbaseTaskTypeDocument(entries["_types/task.md"]);
		const type = parsed.type as Record<string, any>;
		const field = type.fields.status;
		field.values.reverse();
		expect(recognizeLegacyTaskType("---\n" + YAML.stringify(type) + "---\n" + parsed.body, settings)).toBe(false);
	});

	it.each(["body", "quoted name", "renamed type"])("keeps legacy types with edited %s in a foreign v0.3 collection without adding another provider", async (edit) => {
		const h = harness("live-4.13.7-foreign-v03", (entries) => {
			entries["LibraryTypes/task.md"] += "\nUser edit\n";
			if (edit === "quoted name") entries["LibraryTypes/task.md"] = entries["LibraryTypes/task.md"].replace("name: task", 'name: "task"');
			if (edit === "renamed type") entries["LibraryTypes/task.md"] = entries["LibraryTypes/task.md"].replace("name: task", "name: my-tasks");
		});
		const before = new Map(h.files);
		await h.service.initialize();
		expect(h.files).toEqual(before);
		expect(h.notices.join(" ")).toContain("LibraryTypes/task.md");
	});

	it("does not interpret fields-schema examples in a canonical Markdown body as legacy metadata", () => {
		expect(hasLegacyFieldsSchema('---\nkind: mdbase.type\nname: task\nschema: {}\n---\nfields:\n  custom: example\n')).toBe(false);
	});

	it.each(["mdbase.yaml", "_types/task.md"])("waits for delayed %s and retries migration on arrival", async (missing) => {
		let delayed = "";
		const h = harness("live-4.9.2-defaults", (entries) => { delayed = entries[missing]; delete entries[missing]; });
		const before = new Map(h.files);
		await h.service.initialize();
		expect(h.files).toEqual(before);
		h.arrive(missing, delayed);
		// Drain the watcher-requested reconciliation, not a manual initialize retry.
		await (h.service as unknown as { reconcilePromise: Promise<void> }).reconcilePromise;
		h.entries[missing] = delayed;
		h.notices.length = 0;
		assertMigrated(h);
	});

	it("does not generate metadata when only support resources have arrived", async () => {
		const h = harness("writer-4.12.0", (entries) => {
			delete entries["mdbase.yaml"]; delete entries["_types/task.md"];
			entries["_contracts/tasknotes.task.md"] = "---\nname: tasknotes.task\n---\n";
		});
		const before = new Map(h.files);
		await h.service.initialize();
		expect(h.files).toEqual(before);
		expect(h.notices.join(" ")).toContain("without mdbase.yaml");
	});

	it("upgrades CRLF known legacy support but preserves substantive support edits with a named recovery notice", async () => {
		const fixture = JSON.parse(fs.readFileSync(path.join(root, "../beta0-custom.json"), "utf8"));
		for (const edited of [false, true]) {
			const h = harness();
			h.files.clear();
			for (const [p, c] of Object.entries(fixture.files)) h.arrive(p, c as string);
			const resource = "_contracts/tasknotes.task.md";
			const original = h.files.get(resource)!;
			h.files.set(resource, original.replace(/\n/g, "\r\n") + (edited ? "\nCustom commentary\n" : ""));
			await h.service.initialize();
			if (edited) {
				expect(h.files.get(resource)).toContain("Custom commentary");
				expect(h.notices.join(" ")).toMatch(/_contracts\/tasknotes.task.md.*backup/);
			} else {
				expect(parseMdbaseTaskTypeDocument(h.files.get("_types/task.md")!).type.implements).toEqual(expect.arrayContaining([expect.objectContaining({ version: "0.3.0-rc.5" })]));
				expect(h.notices.join(" ")).not.toContain("could not initialize");
			}
		}
	});
});
