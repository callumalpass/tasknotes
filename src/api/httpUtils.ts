import type { HTTPRequestLike, HTTPResponseLike } from "./httpTypes";

const DEFAULT_ALLOW_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const DEFAULT_ALLOW_HEADERS = "Content-Type, Authorization";
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export interface CORSHeaderOptions {
	allowMethods?: string;
	allowHeaders?: string;
	allowOrigin?: string;
}

export function resolveLocalCORSOrigin(
	requestOrigin: string | undefined,
	fallbackOrigin: string
): string | undefined {
	if (!requestOrigin) {
		return fallbackOrigin;
	}

	try {
		const originUrl = new URL(requestOrigin);
		if (originUrl.protocol !== "http:" && originUrl.protocol !== "https:") {
			return undefined;
		}

		return LOOPBACK_HOSTNAMES.has(originUrl.hostname) ? originUrl.origin : undefined;
	} catch {
		return undefined;
	}
}

export function setCORSHeaders(
	res: HTTPResponseLike,
	options?: CORSHeaderOptions
): void {
	if (options?.allowOrigin) {
		res.setHeader("Access-Control-Allow-Origin", options.allowOrigin);
	}
	res.setHeader("Access-Control-Allow-Methods", options?.allowMethods ?? DEFAULT_ALLOW_METHODS);
	res.setHeader("Access-Control-Allow-Headers", options?.allowHeaders ?? DEFAULT_ALLOW_HEADERS);
}

export function sendJSONResponse(
	res: HTTPResponseLike,
	statusCode: number,
	data: unknown,
	corsOptions?: CORSHeaderOptions
): void {
	res.statusCode = statusCode;
	res.setHeader("Content-Type", "application/json");
	setCORSHeaders(res, corsOptions);
	res.end(JSON.stringify(data));
}

export function parseJSONBody(req: HTTPRequestLike): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		let body = "";
			req.on("data", (chunk: string | { toString(): string }) => {
				body += chunk.toString();
			});
		req.on("end", () => {
			try {
				resolve(body ? JSON.parse(body) : {});
			} catch {
				reject(new Error("Invalid JSON"));
			}
		});
		req.on("error", reject);
	});
}
