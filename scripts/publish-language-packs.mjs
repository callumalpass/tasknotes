import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { exportLanguagePacks } from "./lib/language-packs.mjs";
import {
	createPublishPlan,
	IMMUTABLE_CACHE_CONTROL,
	publishPlan,
	verifyPublicObjects,
} from "./lib/language-pack-publishing.mjs";

const args = process.argv.slice(2);
if (args.length > 1 || args.some((arg) => !["--apply", "--apply-s3", "--verify"].includes(arg))) {
	throw new Error(
		"Usage: node scripts/publish-language-packs.mjs [--apply | --apply-s3 | --verify] (default: local dry run)"
	);
}
const config = JSON.parse(await readFile("infra/language-packs.json", "utf8"));
const plan = await createPublishPlan(await exportLanguagePacks(), config, resolve("LICENSE"));
if (!args.length) {
	console.log(
		JSON.stringify(
			{
				mode: "dry-run",
				account: config.accountId,
				bucket: config.bucket,
				objects: plan.objects.map((o) => ({ key: o.key, bytes: o.bytes.length })),
			},
			null,
			2
		)
	);
} else if (args[0] === "--verify") {
	await verifyPublicObjects(plan);
	console.log(
		`Verified ${plan.objects.length} public immutable objects at ${config.publicBaseUrl}`
	);
} else if (args[0] === "--apply-s3") {
	const { createR2S3Client } = await import("./lib/language-pack-s3.mjs");
	const client = createR2S3Client(config);
	try {
		console.log(
			JSON.stringify(
				{
					mode: "apply-s3",
					account: config.accountId,
					bucket: config.bucket,
					...(await publishPlan(plan, client)),
				},
				null,
				2
			)
		);
	} finally {
		client.close();
	}
} else {
	const run = promisify(execFile);
	const cli = resolve("node_modules/.bin/wrangler");
	const env = {
		...process.env,
		CLOUDFLARE_ACCOUNT_ID: config.accountId,
		WRANGLER_SEND_METRICS: "false",
		// Wrangler's auth command otherwise copies its token output into debug logs.
		WRANGLER_WRITE_LOGS: "false",
	};
	// Capture credential output only in process memory; never print or persist it.
	let auth;
	try {
		const { stdout } = await run(cli, ["auth", "token", "--json"], { env });
		auth = JSON.parse(stdout);
	} catch {
		throw new Error("Wrangler authentication unavailable; no credential output logged");
	}
	if (!["oauth", "api_token"].includes(auth.type) || typeof auth.token !== "string") {
		throw new Error("Unsupported Wrangler authentication type");
	}
	const api = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucket}`;
	const request = (url) =>
		fetch(url, {
			headers: { Authorization: `Bearer ${auth.token}` },
			signal: AbortSignal.timeout(30_000),
		});
	const bucketResponse = await request(api);
	if (!bucketResponse.ok)
		throw new Error(`Cannot verify target R2 bucket (${bucketResponse.status})`);
	const bucket = await bucketResponse.json();
	if (!bucket.success || bucket.result.name !== config.bucket)
		throw new Error("R2 bucket identity mismatch");
	const client = {
		read: async (key) => {
			const response = await request(`${api}/objects/${key}`);
			if (response.status === 404) return null;
			if (!response.ok) throw new Error(`R2 preflight failed (${response.status}): ${key}`);
			return new Uint8Array(await response.arrayBuffer());
		},
		write: async (object) => {
			try {
				await run(
					cli,
					[
						"r2",
						"object",
						"put",
						`${config.bucket}/${object.key}`,
						"--remote",
						"--file",
						object.path,
						"--content-type",
						object.contentType,
						"--cache-control",
						IMMUTABLE_CACHE_CONTROL,
					],
					{ env }
				);
			} catch {
				throw new Error(
					`R2 upload failed for ${object.key}; inspect remote state before retrying`
				);
			}
			// Confirm the upload at the authenticated origin, independent of public/CDN state.
			const bytes = await client.read(object.key);
			if (bytes === null || !Buffer.from(bytes).equals(object.bytes))
				throw new Error(`R2 post-upload mismatch: ${object.key}`);
		},
	};
	console.log(
		JSON.stringify(
			{
				mode: "apply",
				account: config.accountId,
				bucket: config.bucket,
				...(await publishPlan(plan, client)),
			},
			null,
			2
		)
	);
}
