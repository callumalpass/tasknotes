import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { packFixtures, packFormat } from "../helpers/language-pack-fixtures.mjs";
import { createLanguagePackArtifacts, serialize } from "../../scripts/lib/language-packs.mjs";
import {
	createPublishPlan,
	IMMUTABLE_CACHE_CONTROL,
	publishPlan,
	verifyPublicObjects,
} from "../../scripts/lib/language-pack-publishing.mjs";

async function fixture(t) {
	const directory = await mkdtemp(join(tmpdir(), "tasknotes-publisher-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const { manifest, files } = createLanguagePackArtifacts(
		packFixtures,
		packFormat,
		1_000_000
	);
	for (const [file, bytes] of files) await writeFile(join(directory, file), bytes);
	await writeFile(join(directory, "manifest.json"), serialize(manifest));
	const license = join(directory, "LICENSE");
	await writeFile(license, "MIT fixture\n");
	const config = {
		accountId: "a".repeat(32),
		bucket: "product-language-packs",
		product: "tasknotes",
		publicBaseUrl: "https://i18n.example.test/tasknotes",
		domain: "i18n.example.test",
	};
	const plan = await createPublishPlan({ directory, manifest }, config, license);
	return { directory, manifest, license, config, plan };
}

test("plan includes validated JSON and license, with immutable manifest last", async (t) => {
	const { plan, manifest } = await fixture(t);
	assert.equal(plan.objects.length, 12); // Ten locales, license and manifest.
	assert.ok(plan.objects.some(object => object.key.endsWith("/it.json")));
	assert.equal(plan.objects.at(-1).key, `tasknotes/${manifest.catalogueVersion}/manifest.json`);
	assert.ok(plan.objects.at(-1).manifest);
	assert.ok(plan.objects.every((o) => !o.key.endsWith(".js")));
});

test("rejects corrupt exports and unsafe publishing targets", async (t) => {
	const f = await fixture(t);
	await assert.rejects(
		createPublishPlan(
			f,
			{ ...f.config, publicBaseUrl: "http://i18n.example.test/tasknotes" },
			f.license
		),
		/Invalid public/
	);
	await assert.rejects(
		createPublishPlan(f, { ...f.config, accountId: "wrong" }, f.license),
		/Invalid language/
	);
	await writeFile(join(f.directory, "fr.json"), "corrupt");
	await assert.rejects(createPublishPlan(f, f.config, f.license), /integrity mismatch/);
});

test("origin conflicts abort the entire batch before any upload", async (t) => {
	const { plan } = await fixture(t);
	const writes = [];
	const client = {
		read: async (key) => (key.endsWith("fr.json") ? Buffer.from("wrong") : null),
		write: async (object) => writes.push(object.key),
	};
	await assert.rejects(publishPlan(plan, client), /Refusing immutable overwrite/);
	assert.deepEqual(writes, []);
});

test("origin read failures never become permission to upload", async (t) => {
	const { plan } = await fixture(t);
	const client = {
		read: async () => {
			throw new Error("forbidden");
		},
		write: async () => assert.fail("Must not write"),
	};
	await assert.rejects(publishPlan(plan, client), /forbidden/);
});

test("uploads packs first, verifies public bytes, then publishes the manifest", async (t) => {
	const { plan } = await fixture(t);
	const events = [];
	const client = {
		read: async () => null,
		write: async (o) => events.push(o.manifest ? "manifest" : "data"),
	};
	const verify = async (_plan, _fetcher, objects) =>
		events.push(objects ? "verify-data" : "verify-all");
	assert.deepEqual(await publishPlan(plan, client, verify), { uploaded: 12, reused: 0 });
	assert.deepEqual(events, [...Array(11).fill("data"), "verify-data", "manifest", "verify-all"]);
});

test("failed public verification leaves the manifest unpublished", async (t) => {
	const { plan } = await fixture(t);
	const writes = [];
	const client = { read: async () => null, write: async (o) => writes.push(o) };
	await assert.rejects(
		publishPlan(plan, client, async () => {
			throw new Error("public mismatch");
		}),
		/public mismatch/
	);
	assert.ok(writes.every((o) => !o.manifest));
});

test("identical existing objects are reused without writes", async (t) => {
	const { plan } = await fixture(t);
	const client = {
		read: async (key) => plan.objects.find((o) => o.key === key).bytes,
		write: async () => assert.fail("No overwrite"),
	};
	assert.deepEqual(await publishPlan(plan, client, async () => {}), { uploaded: 0, reused: 12 });
});

test("public verification checks hashes, MIME type, immutable cache policy and CORS", async (t) => {
	const { plan } = await fixture(t);
	const response = async (url, options) => {
		assert.equal(options.headers.Origin, "https://tasknotes.dev");
		const object = plan.objects.find((o) => new URL(url).pathname === `/${o.key}`);
		return new Response(object.bytes, {
			headers: {
				"content-type": object.contentType,
				"cache-control": IMMUTABLE_CACHE_CONTROL,
				"access-control-allow-origin": "*",
			},
		});
	};
	await verifyPublicObjects(plan, response);
	await assert.rejects(
		verifyPublicObjects(plan, async () => new Response("bad", { status: 403 })),
		/403/
	);
	await assert.rejects(
		verifyPublicObjects(plan, async () => new Response("bad")),
		/integrity mismatch/
	);
	await assert.rejects(
		verifyPublicObjects(plan, async (url, options) => {
			const r = await response(url, options);
			r.headers.delete("access-control-allow-origin");
			return r;
		}),
		/metadata\/CORS mismatch/
	);
	assert.ok((await readFile(plan.objects.at(-1).path)).length > 0);
});
