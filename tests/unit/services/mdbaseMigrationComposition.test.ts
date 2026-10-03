import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type TaskNotesPlugin from "../../../src/main";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { MdbaseSpecService } from "../../../src/services/MdbaseSpecService";
import { parseMdbaseTaskTypeDocument } from "../../../src/services/mdbaseCanonicalConfig";
import { METADATA_PENDING } from "../../../src/services/mdbase/MetadataTransaction";
import { recognitionVault } from "../../helpers/mdbaseRecognitionVault";

const root = path.join(__dirname, "../../fixtures/mdbase-upgrades");
function capture(name: string) {
	const entries: Record<string, string> = {};
	const walk = (folder: string) => {
		for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
			const filename = path.join(folder, entry.name);
			if (entry.isDirectory()) walk(filename);
			else if (!["README.md", "settings.json"].includes(entry.name)) entries[path.relative(path.join(root, name), filename)] = fs.readFileSync(filename, "utf8");
		}
	};
	walk(path.join(root, name));
	return entries;
}
function harness(entries: Record<string, string>) {
	const memory = recognitionVault(entries);
	const notices: string[] = [];
	const plugin = {
		settings: { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), enableMdbaseSpec: true, excludedFolders: "Private" },
		app: { vault: memory.vault }, registerEvent: jest.fn(),
		emitter: { trigger: (_event: string, payload: { message: string }) => notices.push(payload.message) },
	} as unknown as TaskNotesPlugin;
	return { ...memory, plugin, notices, service: new MdbaseSpecService(plugin) };
}

describe("composed migration writes", () => {
	it("stages exclusions and the structural policy upgrade as one original-byte-backed transaction", async () => {
		const entries = capture("meaning-policy");
		const h = harness(entries);
		expect(h.plugin.fieldMapper).toBeUndefined();
		await h.service.initialize();
		const type = parseMdbaseTaskTypeDocument(h.files.get("_types/task.md")!).type as any;
		expect(type.implements[0].version).toBe("0.3.0-rc.5");
		expect(type.implements[0].fields.id).toBe("uid");
		expect(type.implements[0].binding.occurrences.future_horizon).toBe("P90D");
		expect(type.match.expr.$expr).toContain('!file.path.startsWith("Private/")');
		expect(YAML.parse(h.files.get("mdbase.yaml")!).settings.record_extensions).toContain("base");
		expect([...h.files].filter(([p]) => p.endsWith("/_types/task.md.bak")).map(([, c]) => c)).toEqual([entries["_types/task.md"]]);
		expect(h.files.has(METADATA_PENDING)).toBe(false);
		for (const [p, c] of Object.entries(entries)) if (!p.startsWith("_") && p.endsWith(".md")) expect(h.files.get(p)).toBe(c);
	});

	it("a torn structural/exclusion stage restores original metadata and never announces an upgrade", async () => {
		const entries = capture("meaning-policy");
		const h = harness(entries);
		const write = h.vault.adapter.write;
		h.vault.adapter.write = async (p, c) => {
			if (p.startsWith("_types/task.md.tasknotes-stage-")) {
				await write(p, c.slice(0, c.length / 2));
				throw new Error("Injected ENOSPC");
			}
			await write(p, c);
		};
		await h.service.initialize();
		for (const [p, c] of Object.entries(entries)) expect(h.files.get(p)).toBe(c);
		expect(h.notices.join(" ")).not.toContain("TaskNotes updated");
		expect(h.notices.join(" ")).toContain("ENOSPC");
		expect(h.files.has(METADATA_PENDING)).toBe(false);
	});

	it("migrates a historical type inside foreign v0.3 through the shared queue without nesting it", async () => {
		const entries = capture("recognition/live-4.13.7-foreign-v03");
		const h = harness(entries);
		h.plugin.settings = JSON.parse(fs.readFileSync(path.join(root, "recognition/live-4.13.7-foreign-v03/settings.json"), "utf8"));
		h.plugin.settings.enableMdbaseSpec = true;
		await h.service.initialize();
		expect(parseMdbaseTaskTypeDocument(h.files.get("LibraryTypes/task.md")!).type.implements).toBeDefined();
		expect(h.files.get("LibraryTypes/book.md")).toBe(entries["LibraryTypes/book.md"]);
		expect(h.files.has("LibraryTypes/tasknotes-task.md")).toBe(false);
		expect([...h.files].some(([p, c]) => p.endsWith("/task.md.bak") && c === entries["LibraryTypes/task.md"])).toBe(true);
	});
});
