import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createR2S3Client } from "../../scripts/lib/language-pack-s3.mjs";
import { IMMUTABLE_CACHE_CONTROL } from "../../scripts/lib/language-pack-publishing.mjs";

const config = {
	accountId: "a".repeat(32),
	bucket: "product-language-packs",
	product: "tasknotes",
};
const env = {
	LANGUAGE_PACK_R2_ACCESS_KEY_ID: "test-only",
	LANGUAGE_PACK_R2_SECRET_ACCESS_KEY: "not-a-real-credential",
};
const object = {
	key: `tasknotes/${"b".repeat(64)}/fr.json`,
	bytes: Buffer.from('{"example":"Français"}\n'),
	contentType: "application/json; charset=utf-8",
};
const missing = () =>
	Object.assign(new Error("not logged"), {
		name: "NoSuchKey",
		$metadata: { httpStatusCode: 404 },
	});
const body = (bytes) => ({
	Body: { transformToByteArray: async () => bytes },
	ContentLength: bytes.length,
});

test("requires explicit R2 credentials and rejects cross-product or traversal keys", async () => {
	assert.throws(() => createR2S3Client(config, {}), /no personal credential fallback/);
	const client = createR2S3Client(config, env, { send: () => assert.fail("Must not send") });
	await assert.rejects(client.read("other/../secret.json"), /Invalid immutable/);
	await assert.rejects(
		client.read(object.key.replace("tasknotes/", "mdbase-reader/")),
		/Invalid immutable/
	);
});

test("origin read only treats NoSuchKey 404 as absence", async () => {
	let error = missing();
	const client = createR2S3Client(config, env, {
		send: async () => {
			throw error;
		},
	});
	assert.equal(await client.read(object.key), null);
	for (const [name, status] of [
		["NoSuchBucket", 404],
		["AccessDenied", 403],
		["Unavailable", 503],
	]) {
		error = Object.assign(new Error("private service details"), {
			name,
			$metadata: { httpStatusCode: status },
		});
		await assert.rejects(client.read(object.key), /origin read failed/);
	}
});

test("PUT always uses IfNoneMatch and verifies origin bytes after success", async () => {
	let stored;
	const inputs = [];
	const client = createR2S3Client(config, env, {
		send: async (command) => {
			inputs.push(command.input);
			if (command instanceof PutObjectCommand) {
				stored = command.input.Body;
				return {};
			}
			assert.ok(command instanceof GetObjectCommand);
			return body(stored);
		},
	});
	assert.equal(await client.write(object), true);
	assert.equal(inputs[0].IfNoneMatch, "*");
	assert.equal(inputs[0].CacheControl, IMMUTABLE_CACHE_CONTROL);
	assert.equal(inputs[0].ContentType, object.contentType);
	assert.equal(inputs[0].Bucket, config.bucket);
});

test("reconciles identical races and uncertain success without unconditional overwrite", async () => {
	for (const status of [412, 409, 503]) {
		let puts = 0;
		const client = createR2S3Client(config, env, {
			send: async (command) => {
				if (command instanceof PutObjectCommand) {
					puts++;
					throw { $metadata: { httpStatusCode: status } };
				}
				return body(object.bytes);
			},
		});
		assert.equal(await client.write(object), false);
		assert.equal(puts, 1);
	}
});

test("conflicts and unsupported conditions fail closed and never try unconditional PUT", async () => {
	let puts = 0;
	const client = createR2S3Client(config, env, {
		send: async (command) => {
			if (command instanceof PutObjectCommand) {
				puts++;
				assert.equal(command.input.IfNoneMatch, "*");
				throw { $metadata: { httpStatusCode: 501 } };
			}
			return body(Buffer.from("different"));
		},
	});
	await assert.rejects(client.write(object), /conflicting bytes/);
	assert.equal(puts, 1);
});

test("rejects oversized origin objects before consuming their body", async () => {
	const client = createR2S3Client(config, env, {
		send: async () => ({
			ContentLength: 2_000_000,
			Body: { transformToByteArray: () => assert.fail("Must not buffer") },
		}),
	});
	await assert.rejects(client.read(object.key), /origin read failed/);
});

test("real AWS SDK signs conditional HTTP writes; identical and conflicting concurrent writers reconcile", async (t) => {
	const objects = new Map();
	const puts = [];
	const server = createServer(async (request, response) => {
		assert.match(request.headers.authorization, /^AWS4-HMAC-SHA256 /);
		const key = decodeURIComponent(request.url).split("?")[0];
		const xml = (status, code) => {
			response.writeHead(status, { "content-type": "application/xml" });
			response.end(`<Error><Code>${code}</Code><Message>Test origin</Message></Error>`);
		};
		if (request.method === "GET") {
			const stored = objects.get(key);
			if (!stored) return xml(404, "NoSuchKey");
			response.writeHead(200, { "content-length": stored.length });
			response.end(stored);
			return;
		}
		assert.equal(request.method, "PUT");
		assert.equal(request.headers["if-none-match"], "*");
		assert.equal(request.headers["cache-control"], IMMUTABLE_CACHE_CONTROL);
		const chunks = [];
		for await (const chunk of request) chunks.push(chunk);
		puts.push(key);
		if (objects.has(key)) return xml(412, "PreconditionFailed");
		objects.set(key, Buffer.concat(chunks));
		response.writeHead(200, { etag: '"fixture"' });
		response.end();
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const sdk = new S3Client({
		region: "auto",
		endpoint: `http://127.0.0.1:${server.address().port}`,
		forcePathStyle: true,
		credentials: {
			accessKeyId: env.LANGUAGE_PACK_R2_ACCESS_KEY_ID,
			secretAccessKey: env.LANGUAGE_PACK_R2_SECRET_ACCESS_KEY,
		},
		requestChecksumCalculation: "WHEN_REQUIRED",
		responseChecksumValidation: "WHEN_REQUIRED",
		maxAttempts: 1,
	});
	t.after(() => {
		sdk.destroy();
		server.closeAllConnections();
		server.close();
	});
	const client = createR2S3Client(config, env, sdk);
	assert.equal(await client.read(object.key), null);
	assert.deepEqual((await Promise.all([client.write(object), client.write(object)])).sort(), [
		false,
		true,
	]);
	assert.equal(puts.length, 2);
	await assert.rejects(
		client.write({ ...object, bytes: Buffer.from("conflicting") }),
		/conflicting bytes/
	);
	assert.deepEqual(Buffer.from(await client.read(object.key)), object.bytes);
});
