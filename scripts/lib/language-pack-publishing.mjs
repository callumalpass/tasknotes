import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Accept only the export produced for this pinned catalogue; never arbitrary directory uploads. */
export async function createPublishPlan({ manifest, directory }, config, licensePath) {
	if (
		manifest.product !== "tasknotes" ||
		config.product !== manifest.product ||
		!/^[a-f0-9]{64}$/.test(manifest.catalogueVersion) ||
		!/^[a-f0-9]{32}$/.test(config.accountId) ||
		!/^[a-z0-9][a-z0-9-]{1,62}$/.test(config.bucket)
	)
		throw new Error("Invalid language-pack publishing target");
	const base = new URL(config.publicBaseUrl);
	if (
		base.protocol !== "https:" ||
		base.username ||
		base.password ||
		base.search ||
		base.hash ||
		base.pathname !== `/${config.product}` ||
		base.hostname !== config.domain
	) {
		throw new Error("Invalid public language-pack URL");
	}
	const objects = [];
	const prefix = `${manifest.product}/${manifest.catalogueVersion}`;
	for (const [locale, descriptor] of Object.entries(manifest.packs)) {
		if (!/^[a-z]{2}(?:-[A-Za-z0-9]+)*$/.test(locale) || descriptor.file !== `${locale}.json`) {
			throw new Error("Invalid language-pack filename");
		}
		const path = join(directory, descriptor.file);
		const bytes = await readFile(path);
		if (bytes.length !== descriptor.bytes || sha256(bytes) !== descriptor.sha256) {
			throw new Error(`Export integrity mismatch: ${locale}`);
		}
		objects.push({
			key: `${prefix}/${descriptor.file}`,
			path,
			bytes,
			contentType: "application/json; charset=utf-8",
		});
	}
	const license = await readFile(licensePath);
	objects.push({
		key: `${prefix}/LICENSE.txt`,
		path: licensePath,
		bytes: license,
		contentType: "text/plain; charset=utf-8",
	});
	const path = join(directory, "manifest.json");
	const bytes = await readFile(path);
	if (!isDeepStrictEqual(JSON.parse(bytes.toString("utf8")), manifest)) {
		throw new Error("Export manifest mismatch");
	}
	// Publish discovery metadata only after every pack is present and publicly verified.
	objects.push({
		key: `${prefix}/manifest.json`,
		path,
		bytes,
		contentType: "application/json; charset=utf-8",
		manifest: true,
	});
	return { config, objects };
}

export async function verifyPublicObjects(plan, fetcher = fetch, objects = plan.objects) {
	for (const object of objects) {
		const url = `${new URL(plan.config.publicBaseUrl).origin}/${object.key}`;
		const response = await fetcher(url, {
			signal: AbortSignal.timeout(30_000),
			headers: { Origin: "https://tasknotes.dev" },
		});
		if (!response.ok)
			throw new Error(
				`Public language-pack verification failed (${response.status}): ${object.key}`
			);
		const bytes = new Uint8Array(await response.arrayBuffer());
		if (sha256(bytes) !== sha256(object.bytes))
			throw new Error(`Public integrity mismatch: ${object.key}`);
		if (
			response.headers.get("content-type") !== object.contentType ||
			response.headers.get("cache-control") !== IMMUTABLE_CACHE_CONTROL ||
			response.headers.get("access-control-allow-origin") !== "*"
		) {
			throw new Error(`Public metadata/CORS mismatch: ${object.key}`);
		}
	}
}

/** Preflight all objects against the authenticated, strongly consistent origin (not CDN cache).
 * Never deletes anything. Read-before-create protects against conflicting overwrites, not
 * concurrent writers: serialize publishers until an S3 conditional-write backend is added.
 */
export async function publishPlan(plan, client, verify = verifyPublicObjects) {
	const missing = new Set();
	for (const object of plan.objects) {
		const existing = await client.read(object.key);
		if (existing === null) missing.add(object.key);
		else if (sha256(existing) !== sha256(object.bytes))
			throw new Error(`Refusing immutable overwrite: ${object.key}`);
	}
	const data = plan.objects.filter((object) => !object.manifest);
	for (const object of data) {
		if (missing.has(object.key)) await client.write(object);
	}
	await verify(plan, undefined, data);
	for (const object of plan.objects.filter((object) => object.manifest)) {
		if (missing.has(object.key)) await client.write(object);
	}
	await verify(plan);
	return { uploaded: missing.size, reused: plan.objects.length - missing.size };
}
