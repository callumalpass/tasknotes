/**
 * Upgrade matrix for collections written by shipped TaskNotes releases.
 *
 * Each fixture in tests/fixtures/mdbase-upgrades is the exact collection a
 * released build produced (see the fixture README): TaskNotes 4.13.6 (mdbase
 * v0.2), the 5.0.0 betas (tasknotes.task 0.3.0-rc.3) and a beta.0 collection
 * whose v0.2 metadata that beta left unchanged; and collections TaskNotes App
 * set up through Connect ("app-", with an mdbase.lock.yaml). This release must
 * bring every one of them to the current contract without touching records,
 * and leave a collection that is already current exactly as it is.
 */
import { TFile } from "obsidian";
import * as fs from "fs";
import * as path from "path";
import YAML from "yaml";
import { TASKNOTES_SPEC_VERSION } from "@tasknotes/model";

import { FieldMapper } from "../../../src/services/FieldMapper";
import { MdbaseSpecService } from "../../../src/services/MdbaseSpecService";
import { canonicalTaskNotesResources } from "../../../src/services/canonicalTaskNotesPack";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";

const FIXTURES = path.join(__dirname, "../../fixtures/mdbase-upgrades");

// The settings each fixture was captured with. "custom" users mapped due to
// "deadline", added a number field and a skipped "cancelled" status.
function settingsFor(profile: string): Record<string, any> {
	const settings: Record<string, any> = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
	settings.enableMdbaseSpec = true;
	if (profile === "custom") {
		const status = (value: string, label: string, color: string, order: number, extra = {}) => ({
			id: value, value, label, color, isCompleted: value === "done", order, autoArchive: false, autoArchiveDelay: 5, ...extra,
		});
		settings.customStatuses = [
			status("none", "None", "#cccccc", 0),
			status("open", "Open", "#808080", 1),
			status("in-progress", "In progress", "#0066cc", 2),
			status("done", "Done", "#00aa00", 3),
			status("cancelled", "Cancelled", "#808080", 4, { isSkipped: true, excludeFromCycle: true }),
		];
		settings.fieldMapping = { ...settings.fieldMapping, due: "deadline" };
		settings.userFields = [{ id: "effort", displayName: "Effort", key: "effort", type: "number" }];
		settings.taskFilenameFormat = "zettel";
		settings.storeTitleInFilename = false;
	}
	return settings;
}

function memoryVault(entries: Record<string, string>) {
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
	const vault = {
		adapter: {
			exists: async (p: string) => files.has(p) || folders.has(p),
			read: async (p: string) => {
				const content = files.get(p);
				if (content === undefined) throw new Error(`Missing file: ${p}`);
				return content;
			},
			write: async (p: string, content: string) => { files.set(p, content); parents(p); },
			remove: async (p: string) => { files.delete(p); },
			rename: async (from: string, to: string) => {
				const content = files.get(from);
				if (content === undefined) throw new Error(`Missing file: ${from}`);
				files.set(to, content); files.delete(from); parents(to);
			},
			mkdir: async (p: string) => { folders.add(p); parents(`${p}/x`); },
			list: async (folder: string) => {
				const prefix = folder ? `${folder}/` : "";
				const direct = (p: string) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/");
				return { files: [...files.keys()].filter(direct), folders: [...folders].filter((p) => p !== folder && direct(p)) };
			},
		},
		on: () => ({}),
		getAbstractFileByPath: (p: string) => (files.has(p) ? new (TFile as any)(p) : null),
		process: async (file: { path: string }, update: (content: string) => string) => {
			const next = update(files.get(file.path)!);
			files.set(file.path, next);
			return next;
		},
		create: async (p: string, content: string) => {
			if (files.has(p)) throw new Error(`File exists: ${p}`);
			files.set(p, content);
			parents(p);
			return { path: p };
		},
		createFolder: async (p: string) => { folders.add(p); parents(`${p}/x`); },
	};
	return { files, vault };
}

async function load(files: Map<string, string>, vault: unknown, settings: Record<string, any>) {
	const notices: string[] = [];
	const plugin: any = {
		settings,
		fieldMapper: new FieldMapper(settings.fieldMapping),
		app: { vault },
		registerEvent: () => {},
		emitter: { trigger: (_event: string, message: any) => notices.push(String(message?.message ?? message)) },
		saveSettings: async () => {},
	};
	const service = new MdbaseSpecService(plugin);
	await service.initialize();
	service.flushPendingNotices();
	return notices;
}

function frontmatter(document: string): Record<string, any> {
	return YAML.parse(document.slice(4, document.indexOf("\n---", 4)));
}

const canonical = (source: string) =>
	canonicalTaskNotesResources.find((resource) => resource.source === source)!.document;

const fixtures = fs.readdirSync(FIXTURES).filter((name) => name.endsWith(".json"));

describe("upgrading collections written by shipped TaskNotes releases", () => {
	it("has fixtures for every shipped state", () => {
		expect(fixtures.length).toBeGreaterThanOrEqual(15);
	});

	it.each(fixtures)("%s", async (name) => {
		const profile = name.endsWith("-custom.json") ? "custom" : "default";
		const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8"));
		const before: Record<string, string> = fixture.files;
		const { files, vault } = memoryVault(before);
		const settings = settingsFor(profile);

		const notices = await load(files, vault, settings);
		if (name.startsWith("app-rc17")) {
			// Already current: additive App config only; omitted membership keys retain engine defaults.
			const { "mdbase.yaml": config, ...rest } = Object.fromEntries(files);
			const { "mdbase.yaml": _previous, ...previous } = before;
			expect(Object.fromEntries(Object.entries(rest).filter(([path]) => !path.startsWith(".tasknotes/migrations/")))).toEqual(previous);
			const configBackups = [...files].filter(([path]) => path.startsWith(".tasknotes/migrations/") && path.endsWith("/mdbase.yaml.bak"));
			expect(configBackups.map(([, content]) => content)).toEqual([_previous]);
			expect(YAML.parse(config).settings.explicit_type_keys).toBeUndefined();
			expect(YAML.parse(config).settings.record_extensions).toEqual(expect.arrayContaining(["md", "base"]));
			expect(notices).toEqual([]);
		}

		const config = YAML.parse(files.get("mdbase.yaml")!);
		expect(config.spec_version).toBe("0.3.0");

		const typePaths = [...files.keys()].filter((p) => /^_types\/[^/]+\.md$/.test(p));
		const taskTypes = typePaths.filter((p) =>
			(frontmatter(files.get(p)!).implements ?? []).some((i: any) => i.contract === "tasknotes.task")
		);
		expect(taskTypes).toEqual(["_types/task.md"]);
		const type = frontmatter(files.get("_types/task.md")!);
		const implementation = type.implements.find((i: any) => i.contract === "tasknotes.task");
		expect(implementation.version).toBe(TASKNOTES_SPEC_VERSION);
		expect(implementation.fields.assignees).toBe("assignees");
		expect(type.collection.links["assignees[]"]).toBeDefined();

		expect(files.get("_contracts/tasknotes.task.md")).toBe(canonical(`contracts/tasknotes.task/${TASKNOTES_SPEC_VERSION}.md`));
		expect(files.get("_schemas/tasknotes/tasknotes-task.schema.json")).toBe(
			canonical(`schemas/tasknotes.task/${TASKNOTES_SPEC_VERSION}.schema.json`)
		);
		expect(files.get("_schemas/tasknotes/tasknotes-task-binding.schema.json")).toBe(
			canonical(`schemas/tasknotes.task.binding/${TASKNOTES_SPEC_VERSION}.schema.json`)
		);

		for (const record of ["TaskNotes/Tasks/cancelled.md", "TaskNotes/Tasks/open.md", "paper.md"]) {
			expect(files.get(record)).toBe(before[record]);
		}
		expect([...files.keys()].filter((p) => p.includes("tasknotes-backup"))).toEqual([]);
		expect(notices.filter((n) => /invalid|could not|left the existing|preserved/i.test(n))).toEqual([]);

		const statuses = implementation.binding.status.values;
		if (name.startsWith("app-")) {
			// The collection's own type wins over plugin settings.
			expect(statuses).toContain("cancelled");
		} else if (profile === "custom") {
			expect(statuses).toContain("cancelled");
			expect(implementation.binding.status.skipped_values).toEqual(["cancelled"]);
			expect(implementation.fields.due).toBe("deadline");
		}

		const snapshot = new Map(files);
		const again = await load(files, vault, settingsFor(profile));
		expect(files).toEqual(snapshot);
		expect(again).toEqual([]);
	});
});
