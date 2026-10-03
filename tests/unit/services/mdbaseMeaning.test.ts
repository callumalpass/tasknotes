import * as fs from "fs";
import * as path from "path";
import YAML from "yaml";
import { TFile } from "obsidian";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { MdbaseSpecService } from "../../../src/services/MdbaseSpecService";
import { parseMdbaseTaskTypeDocument, validateCanonicalTaskType, mergeCanonicalTaskTypeDocument } from "../../../src/services/mdbaseCanonicalConfig";
import { checkCollection, repairCollectionRecord } from "../../../src/services/mdbase/checkCollection";
import { addAppCollectionConfig, applyTaskExclusions, effectiveMembershipKeys, taskExclusionExpression } from "../../../src/services/mdbase/collectionConfig";
import { buildTaskNotesMdbaseResources } from "@tasknotes/model/mdbase";
import { createTaskNotesCommandDefinitions } from "../../../src/commands/taskNotesCommands";

const root = path.join(__dirname, "../../fixtures/mdbase-upgrades");
function capture(name: string): Record<string, string> {
	const entries: Record<string, string> = {};
	const walk = (folder: string, prefix = "") => {
		for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
			const relative = prefix + entry.name;
			if (entry.isDirectory()) walk(path.join(folder, entry.name), `${relative}/`);
			else if (entry.name !== "README.md") entries[relative] = fs.readFileSync(path.join(folder, entry.name), "utf8");
		}
	};
	walk(path.join(root, name));
	return entries;
}
const doc = (type: any) => `---\n${YAML.stringify(type)}---\n# User body\n`;
const typeOf = (markdown: string): any => parseMdbaseTaskTypeDocument(markdown).type;

function harness(entries: Record<string, string>) {
	const files = new Map(Object.entries(entries));
	const folders = new Set<string>();
	const parents = (p: string) => {
		let folder = "";
		for (const part of p.split("/").slice(0, -1)) { folder = folder ? `${folder}/${part}` : part; folders.add(folder); }
	};
	for (const file of files.keys()) parents(file);
	const file = (p: string) => Object.assign(new (TFile as any)(p), { stat: { ctime: Date.UTC(2026, 0, 1), mtime: 1, size: 1 }, basename: path.basename(p, ".md") });
	const notices: string[] = [];
	let failBackup = false;
	let race = false;
	const vault: any = {
		adapter: {
			exists: async (p: string) => files.has(p) || folders.has(p),
			read: async (p: string) => { if (!files.has(p)) throw new Error(`Missing ${p}`); return files.get(p); },
			write: async (p: string, content: string) => { files.set(p, content); parents(p); },
			rename: async (from: string, to: string) => {
				const content = files.get(from);
				if (content === undefined) throw new Error(`Missing ${from}`);
				files.set(to, content); files.delete(from); parents(to);
			},
			remove: async (p: string) => { files.delete(p); },
			list: async (folder: string) => {
				const prefix = `${folder}/`;
				const direct = (p: string) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/");
				return { files: [...files.keys()].filter(direct), folders: [...folders].filter(direct) };
			},
		},
		getMarkdownFiles: () => [...files.keys()].filter((p) => p.endsWith(".md")).map(file),
		getAbstractFileByPath: (p: string) => files.has(p) ? file(p) : null,
		read: async (f: TFile) => files.get(f.path),
		process: async (f: TFile, update: (content: string) => string) => {
			if (race) files.set(f.path, files.get(f.path) + "\nConcurrent edit\n");
			const next = update(files.get(f.path)!); files.set(f.path, next); return next;
		},
		create: async (p: string, content: string) => {
			if (failBackup && p.endsWith(".bak")) throw new Error("Backup failed");
			if (files.has(p)) throw new Error("Already exists");
			files.set(p, content); parents(p); return file(p);
		},
		createFolder: async (p: string) => { folders.add(p); },
		on: () => ({}),
	};
	// Exactly the pre-FieldMapper bootstrap state: initialize must not depend on a runtime mapper.
	const plugin: any = {
		settings: { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), enableMdbaseSpec: true },
		app: { vault }, registerEvent: () => {}, saveSettingsDataOnly: async () => {},
		emitter: { trigger: (_event: string, message: any) => notices.push(String(message?.message ?? message)) },
	};
	const service = new MdbaseSpecService(plugin);
	return { files, plugin, service, notices, setFailBackup: () => { failBackup = true; }, setRace: () => { race = true; } };
}

describe("migration meaning preservation", () => {
	it("COMPAT-02: cold bootstrap structurally lifts captured rc.3 without resetting mapping, binding, custom constraints or body", async () => {
		const entries = capture("meaning-policy");
		const before = typeOf(entries["_types/task.md"]);
		const h = harness(entries);
		expect(h.plugin.fieldMapper).toBeUndefined();
		await h.service.initialize();
		const after = typeOf(h.files.get("_types/task.md")!);
		expect(after.implements[0].fields).toEqual({ ...before.implements[0].fields, assignees: "assignees" });
		expect(after.implements[0].binding).toEqual(before.implements[0].binding);
		expect(after.implements[0].fields.id).toBe("uid");
		expect(after.implements[0].binding.archive.archived_tag).toBe("cold");
		expect(after.implements[0].binding.occurrences.future_horizon).toBe("P90D");
		expect(after.schema.value.allOf).toEqual(before.schema.value.allOf);
		expect([...h.files.entries()].some(([p, content]) => p.endsWith(".bak") && content === entries["_types/task.md"])).toBe(true);
		for (const p of ["uid-task.md", "TaskNotes/Tasks/cancelled.md", "TaskNotes/Tasks/open.md"]) expect(h.files.get(p)).toBe(entries[p]);
		const snapshot = new Map(h.files); await h.service.initialize(); expect(h.files).toEqual(snapshot);
	});

	it("COMPAT-02: normal settings write does not add an unowned optional ID mapping or lifecycle", () => {
		const prior = typeOf(capture("meaning-policy")["_types/task.md"]);
		prior.implements[0].version = "0.3.0-rc.5";
		delete prior.implements[0].fields.id;
		delete prior.collection.unique;
		delete prior.schema.value.properties.id;
		delete prior.lifecycle.on_create.set.id;
		const after = typeOf(mergeCanonicalTaskTypeDocument(doc(prior), buildTaskNotesMdbaseResources()));
		expect(after.implements[0].fields.id).toBeUndefined();
		expect(after.lifecycle.on_create.set.id).toBeUndefined();
		expect(after.collection.unique).toBeUndefined();
	});

	it("COMPAT-02: normal settings write keeps stable ID, portable policies, user constraints and extensions", () => {
		const prior = typeOf(capture("meaning-policy")["_types/task.md"]);
		prior.implements[0].version = "0.3.0-rc.5";
		prior.implements[0]["x-owner"] = { note: "keep" };
		prior.schema.value.properties.uid.maxLength = 99;
		prior.schema.value.properties.title.minLength = 12;
		prior.schema.value.allOf.push({ properties: { title: { maxLength: 200 } } });
		prior.schema.value.required.push("due");
		const generated = buildTaskNotesMdbaseResources({ archive: { moveOnArchive: true, folder: "New archive" } });
		const after = typeOf(mergeCanonicalTaskTypeDocument(doc(prior), generated));
		expect(after.implements[0].fields.id).toBe("uid");
		expect(after.implements[0].binding.occurrences).toEqual(prior.implements[0].binding.occurrences);
		expect(after.implements[0].binding.archive).toEqual({ archived_tag: "cold", move_on_archive: true, folder: "New archive" });
		expect(after.implements[0]["x-owner"]).toEqual({ note: "keep" });
		expect(after.schema.value.properties.uid.maxLength).toBe(99);
		expect(after.schema.value.properties.title.minLength).toBe(12);
		expect(after.schema.value.allOf).toContainEqual({ properties: { title: { maxLength: 200 } } });
		expect(after.schema.value.required).toContain("due");
	});

	it.each([undefined, [], ["custom_type"]])("COMPAT-06: preserves effective existing keys %j", async (keys) => {
		const entries = capture("meaning-policy");
		const config = YAML.parse(entries["mdbase.yaml"]);
		if (keys === undefined) delete config.settings.explicit_type_keys; else config.settings.explicit_type_keys = keys;
		entries["mdbase.yaml"] = YAML.stringify(config);
		entries["explicit.md"] = "---\ntype: task\nstatus: open\ndateCreated: 2026-01-01T00:00:00Z\n---\n";
		const h = harness(entries); await h.service.initialize();
		expect(YAML.parse(h.files.get("mdbase.yaml")!).settings.explicit_type_keys).toEqual(keys);
		expect(effectiveMembershipKeys(keys)).toEqual(keys ?? ["type", "types"]);
		expect(h.files.get("explicit.md")).toBe(entries["explicit.md"]);
	});

	it("PATHS-04: additively includes md/base and configured Base folders without touching membership, foreign options or existing includes", async () => {
		const h = harness(capture("meaning-folders"));
		await h.service.initialize();
		const migrated = YAML.parse(h.files.get("mdbase.yaml")!);
		expect(migrated.settings.record_extensions).toEqual(expect.arrayContaining(["md", "base"]));
		expect(migrated["x-obsidian"].bases.include).toContain("TaskNotes/Views/**/*.base");
		const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
		settings.commandFileMapping["open-tasks-view"] = "Work/Views/tasks.base";
		const before = "# Keep this comment\nspec_version: 0.3.0\nsettings:\n  record_extensions: [md, txt]\n  explicit_type_keys: []\n  exclude: [Private]\nx-obsidian:\n  bases:\n    include: [Other/**/*.base]\n    extra: true\nx-user: 9\n";
		const after = addAppCollectionConfig(before, settings);
		const config = YAML.parse(after);
		expect(config.settings.record_extensions).toEqual(["md", "txt", "base"]);
		expect(config.settings.explicit_type_keys).toEqual([]);
		expect(config.settings.exclude).toEqual(["Private"]);
		expect(config["x-obsidian"].bases.include).toEqual(["Other/**/*.base", "TaskNotes/Views/**/*.base", "Work/Views/**/*.base"]);
		expect(config["x-obsidian"].bases.extra).toBe(true);
		expect(after).toContain("# Keep this comment");
		expect(addAppCollectionConfig(after, settings)).toBe(after);
	});

	it("MATRIX-02: exclusions encode exact folder boundaries, escape CEL literals and preserve user predicates", async () => {
		const entries = capture("meaning-folders");
		const h = harness(entries);
		h.plugin.settings.excludedFolders = "Excluded, Templates, Excluded, Nested/Child";
		await h.service.initialize();
		const after = typeOf(h.files.get("_types/task.md")!);
		expect(after.match.where).toEqual({ tags: { contains: "task" } });
		expect(after.match.expr.$expr).toBe('!file.path.startsWith("Excluded/") && !file.path.startsWith("Templates/") && !file.path.startsWith("Nested/Child/")');
		expect(YAML.parse(h.files.get("mdbase.yaml")!).settings.exclude).not.toContain("Templates");
		for (const p of ["Excluded/Hidden.md", "Templates/Template task.md", "Work/Actions/Matrix 0.md", "TaskNotes/Views/relationships.base"]) expect(h.files.get(p)).toBe(entries[p]);
		expect(YAML.parse(h.files.get("mdbase.yaml")!)["x-obsidian"].bases.include).toContain("TaskNotes/Views/**/*.base");
		const custom = buildTaskNotesMdbaseResources().type;
		(custom.match as any).expr = { $expr: 'file.path.endsWith(".md")' };
		const first = applyTaskExclusions(doc(custom), "Templates");
		const second = applyTaskExclusions(first, "New");
		expect(typeOf(second).match.expr.$expr).toBe('(file.path.endsWith(".md")) && (!file.path.startsWith("New/"))');
		expect(typeOf(applyTaskExclusions(second, "")).match.expr.$expr).toBe('file.path.endsWith(".md")');
		expect(taskExclusionExpression('Quotes"')).toContain('Quotes\\"/');
	});

	it.each(["mapping", "binding", "schema", "unknownRole"])("COMPAT-07: rejects engine-invalid canonical %s and retains settings/files", async (fault) => {
		const entries = capture("meaning-minimal");
		const prior = typeOf(entries["_types/task.md"]);
		if (fault === "mapping") delete prior.implements[0].fields.dateCreated;
		if (fault === "binding") delete prior.implements[0].binding.title;
		if (fault === "schema") prior.schema.value.properties.status.type = "nonsense";
		if (fault === "unknownRole") prior.implements[0].fields.nonexistent = "status";
		entries["_types/task.md"] = doc(prior);
		expect(validateCanonicalTaskType(prior).valid).toBe(false);
		const h = harness(entries); const settings = JSON.parse(JSON.stringify(h.plugin.settings));
		await h.service.initialize(); await h.service.onSettingsChanged();
		expect(h.files).toEqual(new Map(Object.entries(entries)));
		expect(h.plugin.settings).toEqual(settings);
		expect(h.notices.some((notice) => notice.includes("is inconsistent") && notice.includes("plugin settings were kept"))).toBe(true);
	});
});

describe("explicit collection validation and approved repairs", () => {
	it("MATRIX-08: captured dateless task is reported, scan never writes and approved repair backs up exact bytes and preserves body/comments", async () => {
		const entries = capture("meaning-minimal");
		const h = harness(entries);
		expect(createTaskNotesCommandDefinitions(h.plugin).some((command) => command.id === "check-collection")).toBe(true);
		const problems = await checkCollection(h.plugin);
		expect(problems.map((problem) => problem.file.path)).toEqual(["Tasks/Matrix 0.md"]);
		expect(h.files).toEqual(new Map(Object.entries(entries)));
		expect(problems[0].missingDateCreated).toBe(true);
		const backup = await repairCollectionRecord(h.plugin, problems[0]);
		expect(h.files.get(backup!)).toBe(entries["Tasks/Matrix 0.md"]);
		const repaired = h.files.get("Tasks/Matrix 0.md")!;
		expect(repaired).toContain("# Preserve this comment");
		expect(parseMdbaseTaskTypeDocument(repaired).body).toBe(parseMdbaseTaskTypeDocument(entries["Tasks/Matrix 0.md"]).body);
		expect(typeOf(repaired).dateCreated).toBe("2026-01-01T00:00:00.000Z");
		expect(await checkCollection(h.plugin)).toEqual([]);
	});

	it("invalid statuses never get auto-mapped; an explicit selected replacement is backed up", async () => {
		const fixture = JSON.parse(fs.readFileSync(path.join(root, "beta0-default.json"), "utf8")).files;
		const h = harness(fixture); await h.service.initialize();
		expect(createTaskNotesCommandDefinitions(h.plugin).some((command) => command.id === "check-collection")).toBe(true);
		const problems = await checkCollection(h.plugin);
		const cancelled = problems.find((problem) => problem.invalidStatus)!;
		expect(cancelled.file.path).toBe("TaskNotes/Tasks/cancelled.md");
		expect(await repairCollectionRecord(h.plugin, cancelled)).toBeNull();
		expect(h.files.get(cancelled.file.path)).toBe(cancelled.content);
		await expect(repairCollectionRecord(h.plugin, cancelled, "invented")).rejects.toThrow("proposed repair is no longer valid");
		const backup = await repairCollectionRecord(h.plugin, cancelled, "open");
		expect(h.files.get(backup!)).toBe(cancelled.content);
		expect(typeOf(h.files.get(cancelled.file.path)!).status).toBe("open");
		expect((await checkCollection(h.plugin)).some((problem) => problem.invalidStatus)).toBe(false);
	});

	it("reports but never repairs unrelated invalid fields, and honors path globs and collection exclusions", async () => {
		const entries = capture("meaning-minimal");
		entries["Tasks/Matrix 1.md"] = entries["Tasks/Matrix 1.md"].replace("due: 2026-08-30", "due: not-a-date");
		entries["Private/Invalid.md"] = entries["Tasks/Matrix 1.md"];
		entries["Other/Invalid.md"] = entries["Tasks/Matrix 1.md"];
		const config = YAML.parse(entries["mdbase.yaml"]); config.settings.exclude.push("Private"); entries["mdbase.yaml"] = YAML.stringify(config);
		const type = typeOf(entries["_types/task.md"]); type.match.path_glob = "Tasks/**/*.md"; entries["_types/task.md"] = doc(type);
		const h = harness(entries); const problems = await checkCollection(h.plugin);
		expect(problems.map((problem) => problem.file.path).sort()).toEqual(["Tasks/Matrix 0.md", "Tasks/Matrix 1.md"]);
		const invalidDate = problems.find((problem) => problem.file.path.endsWith("Matrix 1.md"))!;
		expect(await repairCollectionRecord(h.plugin, invalidDate)).toBeNull();
		expect(h.files).toEqual(new Map(Object.entries(entries)));
	});

	it.each(["backup", "race"])("refuses repair on %s failure without overwriting reviewed or concurrent bytes", async (fault) => {
		const h = harness(capture("meaning-minimal")); const [problem] = await checkCollection(h.plugin);
		if (fault === "backup") h.setFailBackup(); else h.setRace();
		await expect(repairCollectionRecord(h.plugin, problem)).rejects.toThrow();
		expect(h.files.get(problem.file.path)).toBe(problem.content + (fault === "race" ? "\nConcurrent edit\n" : ""));
	});
});
