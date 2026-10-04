import type { TFile } from "obsidian";
import {
	frontmatterDiff,
	MdbaseMutationBackend,
	type MdbaseRecord,
	type MdbaseWriteClient,
} from "../../../../src/core/mdbase/MdbaseMutationBackend";
import {
	createVaultFile,
	modifyVaultFile,
	processVaultFile,
	processVaultFrontMatter,
	setMdbaseMutationBackend,
} from "../../../../src/core/VaultMutationService";

class FakeClient implements MdbaseWriteClient {
	records = new Map<string, MdbaseRecord>();
	calls: unknown[] = [];
	settled: string[] = [];
	isRecordPath(path: string) {
		return path.endsWith(".md") && !path.startsWith(".tasknotes-backups/");
	}
	collectionPath(vaultPath: string) {
		return vaultPath.startsWith("Tasks/") ? vaultPath.slice("Tasks/".length) : null;
	}
	async find(path: string, opts: { document: boolean }) {
		const r = this.records.get(path);
		if (!r) return null;
		return opts.document ? r : { ...r, document: undefined };
	}
	async update(seen: MdbaseRecord, changes: { patch: Record<string, unknown>; unset: string[] }) {
		this.calls.push(["update", seen.id, changes]);
		return { mutation: "m1" };
	}
	async replaceDocument(seen: MdbaseRecord, document: string) {
		this.calls.push(["replace", seen.id, seen.document, document]);
		return { mutation: "m2" };
	}
	async create(path: string, document: string) {
		this.calls.push(["create", path, document]);
		return { mutation: "m3" };
	}
	async settle(_w: unknown, vaultPath: string) {
		this.settled.push(vaultPath);
	}
}

const task: MdbaseRecord = {
	id: "r1",
	path: "t.md",
	frontmatter: { status: "open", tags: ["a"], scheduled: "2026-10-04", meta: { x: 1 } },
	document: "---\nstatus: open\n---\nbody\n",
};

function app() {
	return {
		fileManager: { processFrontMatter: jest.fn(async () => {}) },
		vault: {
			process: jest.fn(async (_f: TFile, fn: (c: string) => string) => fn("obsidian")),
			modify: jest.fn(async () => {}),
			create: jest.fn(async (p: string) => ({ path: p }) as TFile),
			getFileByPath: jest.fn((p: string) => ({ path: p }) as TFile),
		},
	};
}

describe("frontmatterDiff", () => {
	it("reports only keys the callback set or removed", () => {
		expect(frontmatterDiff({ a: 1, b: [1, 2], c: { d: 1 }, e: "x" }, { a: 1, b: [1, 2, 3], c: { d: 1 }, f: true })).toEqual({
			patch: { b: [1, 2, 3], f: true },
			unset: ["e"],
		});
		expect(frontmatterDiff({ a: 1 }, { a: undefined })).toEqual({ patch: {}, unset: ["a"] });
	});
});

describe("VaultMutationService with the mdbase backend", () => {
	let client: FakeClient;
	beforeEach(() => {
		client = new FakeClient();
		client.records.set("t.md", task);
		setMdbaseMutationBackend(new MdbaseMutationBackend(client));
	});
	afterEach(() => setMdbaseMutationBackend(null));

	it("turns a frontmatter callback into a field-level update", async () => {
		const a = app();
		await processVaultFrontMatter(a as never, { path: "Tasks/t.md" } as TFile, (fm) => {
			fm.status = "done";
			fm.completedDate = "2026-10-04";
			delete fm.scheduled;
			(fm.tags as string[]).push("b");
		});
		expect(client.calls).toEqual([
			["update", "r1", { patch: { status: "done", tags: ["a", "b"], completedDate: "2026-10-04" }, unset: ["scheduled"] }],
		]);
		expect(client.settled).toEqual(["Tasks/t.md"]);
		expect(a.fileManager.processFrontMatter).not.toHaveBeenCalled();
		expect(task.frontmatter.tags).toEqual(["a"]); // the read view is not mutated
	});

	it("sends nothing when the callback changes nothing", async () => {
		await processVaultFrontMatter(app() as never, { path: "Tasks/t.md" } as TFile, () => {});
		expect(client.calls).toEqual([]);
	});

	it("turns a content callback into a document replace with the read document as base", async () => {
		const out = await processVaultFile(app() as never, { path: "Tasks/t.md" } as TFile, (c) => c.replace("body", "BODY"));
		expect(out).toBe("---\nstatus: open\n---\nBODY\n");
		expect(client.calls).toEqual([["replace", "r1", task.document, out]]);
	});

	it("routes modify and create", async () => {
		const a = app();
		await modifyVaultFile(a as never, { path: "Tasks/t.md" } as TFile, "new");
		const f = await createVaultFile(a as never, "Tasks/n.md", "---\ntitle: n\n---\n");
		expect(f.path).toBe("Tasks/n.md");
		expect(client.calls).toEqual([
			["replace", "r1", task.document, "new"],
			["create", "n.md", "---\ntitle: n\n---\n"],
		]);
		expect(a.vault.modify).not.toHaveBeenCalled();
		expect(a.vault.create).not.toHaveBeenCalled();
	});

	it("leaves files outside the collection, and unknown records, to Obsidian", async () => {
		const a = app();
		await processVaultFrontMatter(a as never, { path: "Other/x.md" } as TFile, (fm) => (fm.a = 1));
		await processVaultFrontMatter(a as never, { path: "Tasks/unknown.md" } as TFile, (fm) => (fm.a = 1));
		await createVaultFile(a as never, "Other/y.md", "y");
		expect(a.fileManager.processFrontMatter).toHaveBeenCalledTimes(2);
		expect(a.vault.create).toHaveBeenCalledTimes(1);
		expect(client.calls).toEqual([]);
	});

	it("creates non-record files (backups) through Obsidian", async () => {
		const a = app();
		await createVaultFile(a as never, "Tasks/.tasknotes-backups/x.md", "b");
		await createVaultFile(a as never, "Tasks/export.ics", "c");
		expect(a.vault.create).toHaveBeenCalledTimes(2);
		expect(client.calls).toEqual([]);
	});

	it("without a backend, behaves exactly as before", async () => {
		setMdbaseMutationBackend(null);
		const a = app();
		await processVaultFrontMatter(a as never, { path: "Tasks/t.md" } as TFile, (fm) => (fm.a = 1));
		expect(a.fileManager.processFrontMatter).toHaveBeenCalledTimes(1);
	});
});
