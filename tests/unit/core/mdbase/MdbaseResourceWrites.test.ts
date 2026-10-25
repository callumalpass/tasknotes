import { MdbaseMutationBackend, type MdbaseRecord, type MdbaseWriteClient, type ResourceOp } from "../../../../src/core/mdbase/MdbaseMutationBackend";
import { setMdbaseMutationBackend } from "../../../../src/core/VaultMutationService";
import { SafeMetadata } from "../../../../src/services/mdbase/SafeMetadata";
import { MetadataTransaction, METADATA_PENDING } from "../../../../src/services/mdbase/MetadataTransaction";

class ResourceClient implements MdbaseWriteClient {
	batches: ResourceOp[][] = [];
	collectionPath(p: string) {
		return p;
	}
	isRecordPath(p: string) {
		return p.endsWith(".md") && !p.startsWith("_types/") && !p.startsWith(".tasknotes/");
	}
	isResourcePath(p: string) {
		return p === "mdbase.yaml" || p.startsWith("_types/") || p.startsWith("_contracts/") || p.startsWith("_schemas/");
	}
	async find(): Promise<MdbaseRecord | null> {
		return null;
	}
	async update() {
		return { mutation: "u" };
	}
	async replaceDocument() {
		return { mutation: "r" };
	}
	async create() {
		return { mutation: "c" };
	}
	async resources(ops: ResourceOp[]) {
		this.batches.push(ops);
		return { mutation: `m${this.batches.length}` };
	}
	async settle() {}
}

function adapter(entries: Record<string, string>) {
	const files = new Map(Object.entries(entries));
	const folders = new Set<string>();
	return {
		files,
		exists: async (p: string) => files.has(p) || folders.has(p),
		read: async (p: string) => files.get(p)!,
		write: async (p: string, c: string) => void files.set(p, c),
		rename: async (a: string, b: string) => {
			files.set(b, files.get(a)!);
			files.delete(a);
		},
		remove: async (p: string) => void files.delete(p),
		mkdir: async (p: string) => void folders.add(p),
		list: async () => ({ files: [], folders: [] }),
	};
}

describe("collection metadata through the mdbase runtime (resource writes)", () => {
	let client: ResourceClient;
	beforeEach(() => {
		client = new ResourceClient();
		setMdbaseMutationBackend(new MdbaseMutationBackend(client));
	});
	afterEach(() => setMdbaseMutationBackend(null));

	it("SafeMetadata.replace of a resource is a resource_put based on the read content", async () => {
		const a = adapter({ "mdbase.yaml": "spec_version: 0.3.0\n" });
		const io = new SafeMetadata(a);
		await io.replace({ path: "mdbase.yaml", content: "spec_version: 0.3.0\n" }, "spec_version: 0.3.0\nsettings: {}\n");
		expect(client.batches).toEqual([[{ kind: "put", path: "mdbase.yaml", doc: "spec_version: 0.3.0\nsettings: {}\n", base: "spec_version: 0.3.0\n" }]]);
		expect(a.files.get("mdbase.yaml")).toBe("spec_version: 0.3.0\n"); // the replica publishes, not TaskNotes
		expect([...a.files.keys()].some((p) => p.includes("tasknotes-stage"))).toBe(false);
	});

	it("a new type from a pack is sent with base null (must_not_exist)", async () => {
		const io = new SafeMetadata(adapter({}));
		await io.replace({ path: "_types/tasknotes.task.md", content: null }, "---\nname: tasknotes.task\n---\n");
		expect(client.batches[0]).toEqual([{ kind: "put", path: "_types/tasknotes.task.md", doc: "---\nname: tasknotes.task\n---\n", base: null }]);
	});

	it("non-resource files (backups) are still written to the vault", async () => {
		const a = adapter({});
		const io = new SafeMetadata(a);
		await io.replace({ path: ".tasknotes/migrations/x/mdbase.yaml.bak", content: null }, "old");
		expect(client.batches).toEqual([]);
		expect(a.files.get(".tasknotes/migrations/x/mdbase.yaml.bak")).toBe("old");
	});

	it("setting a type aside keeps a copy and deletes the resource with its base", async () => {
		const a = adapter({ "_types/task.md": "dup" });
		const io = new SafeMetadata(a);
		await io.move({ path: "_types/task.md", content: "dup" }, ".tasknotes/migrations/superseded/_types/task.md");
		expect(a.files.get(".tasknotes/migrations/superseded/_types/task.md")).toBe("dup");
		expect(client.batches).toEqual([[{ kind: "delete", path: "_types/task.md", base: "dup" }]]);
	});

	it("a metadata transaction is one mutation, with backups but no local swap journal", async () => {
		const a = adapter({ "mdbase.yaml": "v: 1\n", "_types/task.md": "old type" });
		const io = new SafeMetadata(a);
		const tx = new MetadataTransaction(io, async (p) => void (await a.mkdir(p)), async (p) => void a.files.delete(p));
		await tx.run(async () => {
			tx.stage({ path: "_types/task.md", content: "old type" }, "new type");
			tx.stage({ path: "_types/tasknotes.task.md", content: null }, "pack type");
			tx.stage({ path: "mdbase.yaml", content: "v: 1\n" }, "v: 2\n");
		});
		expect(client.batches).toHaveLength(1);
		expect(client.batches[0]).toEqual([
			{ kind: "put", path: "_types/task.md", doc: "new type", base: "old type" },
			{ kind: "put", path: "_types/tasknotes.task.md", doc: "pack type", base: null },
			{ kind: "put", path: "mdbase.yaml", doc: "v: 2\n", base: "v: 1\n" },
		]);
		expect(a.files.has(METADATA_PENDING)).toBe(false);
		expect([...a.files.keys()].some((p) => p.endsWith("manifest.json"))).toBe(true); // backups kept
	});

	it("a concurrent change before commit still aborts", async () => {
		const a = adapter({ "mdbase.yaml": "v: 1\n" });
		const io = new SafeMetadata(a);
		const tx = new MetadataTransaction(io, async () => {}, async () => {});
		await expect(
			tx.run(async () => {
				tx.stage({ path: "mdbase.yaml", content: "v: 1\n" }, "v: 2\n");
				a.files.set("mdbase.yaml", "v: user\n");
			}),
		).rejects.toThrow(/Concurrent metadata change/);
		expect(client.batches).toEqual([]);
	});
});
