import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { IMMUTABLE_CACHE_CONTROL, sha256 } from "./language-pack-publishing.mjs";

/** No default AWS credential chain, arbitrary endpoint, deletes or unconditional writes. */
export function createR2S3Client(config, env = process.env, sdk) {
	if (
		!/^[a-f0-9]{32}$/.test(config.accountId) ||
		!/^[a-z0-9][a-z0-9-]{1,62}$/.test(config.bucket)
	) {
		throw new Error("Invalid R2 S3 target");
	}
	if (!env.LANGUAGE_PACK_R2_ACCESS_KEY_ID || !env.LANGUAGE_PACK_R2_SECRET_ACCESS_KEY) {
		throw new Error(
			"Bucket-scoped LANGUAGE_PACK_R2_ACCESS_KEY_ID and LANGUAGE_PACK_R2_SECRET_ACCESS_KEY are required; no personal credential fallback"
		);
	}
	const client =
		sdk ??
		new S3Client({
			region: "auto",
			endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: env.LANGUAGE_PACK_R2_ACCESS_KEY_ID,
				secretAccessKey: env.LANGUAGE_PACK_R2_SECRET_ACCESS_KEY,
				...(env.LANGUAGE_PACK_R2_SESSION_TOKEN
					? { sessionToken: env.LANGUAGE_PACK_R2_SESSION_TOKEN }
					: {}),
			},
			requestChecksumCalculation: "WHEN_REQUIRED",
			responseChecksumValidation: "WHEN_REQUIRED",
			maxAttempts: 3,
			requestHandler: { connectionTimeout: 10_000, requestTimeout: 30_000 },
		});
	const prefix = `${config.product}/`;
	const checkKey = (key) => {
		if (
			!key.startsWith(prefix) ||
			!/^[a-z0-9-]+\/[a-f0-9]{64}\/(?:[a-z]{2}(?:-[A-Za-z0-9]+)*\.json|manifest\.json|LICENSE\.txt)$/.test(
				key
			)
		) {
			throw new Error("Invalid immutable R2 object key");
		}
	};
	const read = async (key) => {
		checkKey(key);
		try {
			const response = await client.send(
				new GetObjectCommand({ Bucket: config.bucket, Key: key })
			);
			if (!response.Body || response.ContentLength > 1_048_576)
				throw new Error("Invalid object size");
			const bytes = await response.Body.transformToByteArray();
			if (bytes.length > 1_048_576) throw new Error("Invalid object size");
			return bytes;
		} catch (error) {
			// A missing bucket, forbidden request or unavailable origin is never a cache miss.
			if (error.name === "NoSuchKey" && error.$metadata?.httpStatusCode === 404) return null;
			throw new Error(`R2 S3 origin read failed: ${key}`);
		}
	};
	const write = async (object) => {
		checkKey(object.key);
		let created = true;
		try {
			await client.send(
				new PutObjectCommand({
					Bucket: config.bucket,
					Key: object.key,
					Body: object.bytes,
					ContentType: object.contentType,
					CacheControl: IMMUTABLE_CACHE_CONTROL,
					IfNoneMatch: "*",
				})
			);
		} catch (error) {
			// Another publisher may have created it, or a successful PUT may have lost its reply.
			// Reconcile only by reading the strongly consistent origin; never overwrite/retry blindly.
			created = false;
			const existing = await read(object.key);
			if (existing === null || sha256(existing) !== sha256(object.bytes)) {
				throw new Error(
					`Conditional R2 create failed or conflicting bytes exist: ${object.key}`
				);
			}
		}
		const existing = await read(object.key);
		if (existing === null || sha256(existing) !== sha256(object.bytes)) {
			throw new Error(`R2 S3 post-upload integrity mismatch: ${object.key}`);
		}
		return created;
	};
	return { read, write, close: () => client.destroy?.() };
}
